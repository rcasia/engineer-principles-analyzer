# The whole production stack: one Lambda behind a Function URL.
#
# There is deliberately no API Gateway and no CloudFront. A Function URL is
# free, whereas API Gateway bills per request from the first one. See
# docs/adr/0005-aws-lambda-function-url.md.

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "web" {
  name               = "${local.name_prefix}-web"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# Least privilege: the function only ever writes its own log stream.
data "aws_iam_policy_document" "web_logging" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.web.arn}:*"]
  }
}

resource "aws_iam_role_policy" "web_logging" {
  name   = "${local.name_prefix}-web-logging"
  role   = aws_iam_role.web.id
  policy = data.aws_iam_policy_document.web_logging.json
}

# Created explicitly rather than implicitly by Lambda, so retention is capped
# and the group is destroyed with the stack.
resource "aws_cloudwatch_log_group" "web" {
  name              = "/aws/lambda/${local.name_prefix}-web"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "web" {
  function_name = "${local.name_prefix}-web"
  role          = aws_iam_role.web.arn

  filename         = local.lambda_package
  source_code_hash = filebase64sha256(local.lambda_package)

  runtime = "nodejs22.x"
  handler = "handler.handler"

  # Small memory is cheap but slow; 512MB is roughly the cost/latency sweet
  # spot for a render-and-return workload.
  memory_size = 512
  timeout     = 10

  architectures = ["arm64"] # ~20% cheaper per GB-second than x86_64.

  # Present only behind a CDN. When set, the adapter refuses any request whose
  # x-origin-verify header does not match, so a direct hit on the public
  # Function URL is rejected (ADR-0017). Absent on LocalStack, where the
  # Function URL is deliberately open.
  # for_each keys on a constant, not the secret's value: the secret is unknown
  # until apply, and iterating a list whose single element is unknown makes
  # Terraform plan zero blocks and then produce one, which it rejects as an
  # inconsistent final plan. The count is fixed here; only the value inside is
  # deferred.
  dynamic "environment" {
    for_each = local.use_cdn ? ["cdn"] : []

    content {
      variables = {
        ORIGIN_VERIFY_SECRET = random_password.origin_secret[0].result
      }
    }
  }

  depends_on = [
    aws_iam_role_policy.web_logging,
    aws_cloudwatch_log_group.web,
  ]
}

# AuthType NONE in every environment. AWS_IAM plus origin access control
# would sign GET requests, but CloudFront OAC cannot sign a POST/PUT payload
# (it never adds the required x-amz-content-sha256 header), so Lambda rejects
# every POST with a SigV4 signature-mismatch 403. #34's /analyze is a POST
# form and we serve no client-side JavaScript to compute that hash (ADR-0004),
# so OAC is unusable here. The origin is instead kept private by a shared
# secret header that only CloudFront knows (ADR-0017); the application refuses
# any request that arrives without it.
resource "aws_lambda_function_url" "web" {
  function_name      = aws_lambda_function.web.function_name
  authorization_type = "NONE"
}

# The shared secret CloudFront injects on every origin request and the Lambda
# checks. Random, never checked into state in plaintext output, rotated by
# tainting this resource. Only meaningful when a CDN is in front (real AWS);
# on LocalStack the Function URL is intentionally public.
resource "random_password" "origin_secret" {
  count = local.use_cdn ? 1 : 0

  length  = 48
  special = false # Kept to an HTTP-header-safe alphabet.
}

# ----------------------------------------------------------------------------
# Global delivery
#
# A single region cannot serve a global audience: measured round trip from
# western Europe to us-west-2 is ~184ms, to sa-east-1 ~224ms. CloudFront
# terminates TLS at the nearest edge and serves cached HTML without touching
# the origin at all, which also means most users never pay a Lambda cold
# start. The first 1TB and 10M requests each month are permanently free, and
# origin fetches from AWS cost nothing.
#
# A shared secret header keeps the Function URL private: CloudFront injects
# x-origin-verify on every origin request and the adapter refuses any request
# without it, so the cache cannot be bypassed and the Lambda free tier cannot
# be burned through directly. Origin access control would be stronger but
# cannot sign POST payloads, which /analyze needs (ADR-0017).
# ----------------------------------------------------------------------------

locals {
  # "https://abc123.lambda-url.eu-west-1.on.aws/" -> "abc123.lambda-url.eu-west-1.on.aws"
  function_url_host = trimsuffix(
    trimprefix(aws_lambda_function_url.web.function_url, "https://"),
    "/",
  )
  origin_id = "${local.name_prefix}-web-lambda"
}

# A custom cache policy, not the managed "UseOriginCacheControlHeaders" one.
# That managed policy's own header whitelist includes "host" - independently
# of, and merged with, whatever the origin request policy forwards. That
# reintroduces the CloudFront distribution's own Host header on every
# request, which a Lambda Function URL rejects: the URL validates Host against
# its own domain, so a forwarded viewer/CloudFront Host makes the origin
# answer 403. Keeping no headers in the cache key leaves the origin request
# policy below as the single place that decides what reaches the origin.
#
# TTL bounds replicate the managed policy's "honour the origin's
# Cache-Control" behaviour; header/cookie/query-string forwarding is left
# entirely to the origin request policy below, so there is exactly one place
# that decides what reaches the origin.
resource "aws_cloudfront_cache_policy" "web" {
  count = local.use_cdn ? 1 : 0

  name    = "${local.name_prefix}-web"
  comment = "Honours origin Cache-Control. No cache-key headers: the origin request policy owns forwarding, so Host cannot be reintroduced."

  default_ttl = 0
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Managed policies, read only when the CDN is built. Guarding them with count
# matters: LocalStack cannot serve these lookups.
#
# The Host header must not be forwarded: the Function URL validates Host
# against its own domain, so forwarding the viewer's Host makes the origin
# answer 403. Everything else is forwarded; the x-origin-verify secret is
# added separately as an origin custom_header, independent of this policy.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  count = local.use_cdn ? 1 : 0
  name  = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  count = local.use_cdn ? 1 : 0
  name  = "Managed-SecurityHeadersPolicy"
}

# TRANSITIONAL: this origin access control is no longer referenced by the
# distribution below (the origin now authenticates with the x-origin-verify
# custom header, ADR-0017). It is kept in config for exactly one deploy so
# this apply *updates* the distribution to stop using it, rather than trying
# to *delete* it while the distribution still references it - CloudFront
# rejects that with OriginAccessControlInUse, and removing the attribute
# reference dropped the dependency edge that would have ordered the update
# first. A follow-up commit deletes this block once the distribution update
# has propagated. Do not add new references to it.
resource "aws_cloudfront_origin_access_control" "web" {
  count = local.use_cdn ? 1 : 0

  name                              = "${local.name_prefix}-web"
  description                       = "Unused; retained for one deploy to detach cleanly (ADR-0017)."
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  count = local.use_cdn ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} web"

  # Global reach. Everything here is inside the free tier at current traffic,
  # and users in excluded regions would still be served, just from a farther
  # edge - so excluding them buys nothing today.
  price_class = "PriceClass_All"

  origin {
    domain_name = local.function_url_host
    origin_id   = local.origin_id

    # The shared secret that proves a request came through this distribution.
    # The adapter rejects anything without it, so the public Function URL
    # cannot be used to bypass the cache (ADR-0017).
    custom_header {
      name  = "x-origin-verify"
      value = random_password.origin_secret[0].result
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    # CloudFront only accepts three fixed AllowedMethods sets - GET/HEAD,
    # GET/HEAD/OPTIONS, or this full set - there is no "GET/HEAD/OPTIONS/POST"
    # in between. #34 added POST /analyze (a same-origin HTML form submit,
    # not a REST API), so the full set is required even though this origin
    # never needs PUT/PATCH/DELETE; CloudFront returns 403 "not configured to
    # allow the HTTP request method" for any method outside AllowedMethods.
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]
    compress        = true

    cache_policy_id            = aws_cloudfront_cache_policy.web[0].id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host[0].id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers[0].id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# The Function URL is public (AuthType NONE) in every environment, so anyone
# may invoke it - on real AWS the x-origin-verify secret is what actually
# gates access, checked by the adapter, not IAM (ADR-0017). CloudFront reaches
# the origin as an ordinary anonymous HTTPS client, so it needs no
# invoke permission of its own.
resource "aws_lambda_permission" "public_function_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.web.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
