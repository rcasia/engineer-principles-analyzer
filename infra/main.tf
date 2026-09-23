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

  # The Jev credential for language detection (ADR-0028). Absent by default
  # so LocalStack and the CI gate run with no secrets at all: the function
  # starts keyless and reports submissions as undetectable (ADR-0037).
  # Production sets it with -var typesafe_api_key=... (or TF_VAR_...).
  dynamic "environment" {
    for_each = var.typesafe_api_key == null ? [] : [var.typesafe_api_key]

    content {
      variables = {
        TYPESAFE_API_KEY = environment.value
      }
    }
  }

  depends_on = [
    aws_iam_role_policy.web_logging,
    aws_cloudwatch_log_group.web,
  ]
}

# Private behind CloudFront on real AWS (AWS_IAM + origin access control,
# below), public on LocalStack, which has no CloudFront to sign requests
# through. ADR-0017 tried replacing this with AuthType NONE plus a shared
# secret header, specifically to let #34's POST /analyze work (OAC cannot
# sign a POST/PUT payload, so a signed Function URL rejects it - see ADR-0017
# for that reasoning, which still stands on its own). That deploy revealed a
# constraint no application-level config can work around: this AWS account is
# a member of an Organization with a Service Control Policy that blocks
# unauthenticated Lambda Function URL invocation account-wide, independent of
# the function's own AuthType or resource policy - confirmed by invoking the
# URL directly with AWS_PROFILE=epa-bootstrap (root) and getting Lambda's
# generic Function URL "Forbidden" before the handler ever ran, while the
# plain (IAM) Invoke API on the same function succeeded. ADR-0018 reverts to
# AWS_IAM; POST /analyze is knowingly broken again until that SCP is loosened
# from the management account or a signing mechanism (Lambda@Edge) is added.
resource "aws_lambda_function_url" "web" {
  function_name      = aws_lambda_function.web.function_name
  authorization_type = local.use_cdn ? "AWS_IAM" : "NONE"
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
# Origin access control keeps the Function URL private: only this
# distribution can sign requests to it, so the cache cannot be bypassed and
# the Lambda free tier cannot be burned through directly (ADR-0018 - reverted
# here from ADR-0017's shared-secret header, which a Service Control Policy
# in this account's Organization blocks regardless of the Function URL's own
# config).
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
# The Host header must not be forwarded: CloudFront signs requests for the
# Function URL's own host, and overriding it breaks the SigV4 signature.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  count = local.use_cdn ? 1 : 0
  name  = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  count = local.use_cdn ? 1 : 0
  name  = "Managed-SecurityHeadersPolicy"
}

# TRANSITIONAL: no longer referenced by the distribution below - the
# Lambda@Edge signer (ADR-0019) authenticates origin requests now, because
# OAC cannot sign POST bodies. Kept for exactly one deploy so this apply
# *updates* the distribution to stop using it instead of trying to *delete*
# it while still referenced (CloudFront rejects that with
# OriginAccessControlInUse). A follow-up commit deletes this block once the
# distribution update has propagated. Do not add new references to it.
resource "aws_cloudfront_origin_access_control" "web" {
  count = local.use_cdn ? 1 : 0

  name                              = "${local.name_prefix}-web"
  description                       = "Unused; retained for one deploy to detach cleanly (ADR-0019)."
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  count = local.use_cdn ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_prefix} web"

  # Empty until ADR-0041's custom domain is set: without an alias the
  # distribution answers only on its default cloudfront.net domain.
  aliases = local.custom_domain_enabled ? [var.custom_domain] : []

  # Global reach. Everything here is inside the free tier at current traffic,
  # and users in excluded regions would still be served, just from a farther
  # edge - so excluding them buys nothing today.
  price_class = "PriceClass_All"

  origin {
    domain_name = local.function_url_host
    origin_id   = local.origin_id

    # Deploy-time configuration for the Lambda@Edge signer. Edge functions
    # forbid environment variables, so the origin's own host and region
    # travel as custom headers, which the signer reads from
    # origin.custom.customHeaders - the only place they appear (origin
    # custom headers are NOT merged into request.headers at the
    # origin-request trigger; reading them there fail-closed prod until
    # that was found). CloudFront overwrites same-named viewer headers
    # with these values, so they cannot be spoofed (ADR-0019).
    custom_header {
      name  = "x-origin-host"
      value = local.function_url_host
    }

    custom_header {
      name  = "x-origin-region"
      value = var.aws_region
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

    # 301s the default cloudfront.net domain to the custom one (ADR-0041).
    # Absent until the custom domain is set.
    dynamic "function_association" {
      for_each = local.custom_domain_enabled ? [1] : []

      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.canonical_host[0].arn
      }
    }

    # Signs every origin request - GET and POST alike - with SigV4 using the
    # signer's own credentials, which the Function URL authorizes (ADR-0019).
    # include_body is what makes POST work: without it the trigger never sees
    # the bytes it must hash.
    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = "${aws_lambda_function.edge_signer[0].arn}:${aws_lambda_function.edge_signer[0].version}"
      include_body = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Default certificate until ADR-0041's custom domain is set: aliases
    # require an ACM certificate, which CloudFront only accepts from
    # us-east-1. Referencing the validation (not the certificate) keeps the
    # distribution waiting until DNS validation has completed.
    cloudfront_default_certificate = !local.custom_domain_enabled
    acm_certificate_arn            = local.custom_domain_enabled ? aws_acm_certificate_validation.custom[0].certificate_arn : null
    ssl_support_method             = local.custom_domain_enabled ? "sni-only" : null
    minimum_protocol_version       = local.custom_domain_enabled ? "TLSv1.2_2021" : null
  }
}

# ----------------------------------------------------------------------------
# Lambda@Edge origin-request signer (ADR-0019)
#
# Signs every CloudFront origin request with SigV4 - including POST bodies,
# which origin access control cannot sign - so the AWS_IAM Function URL
# accepts them. The function must live in us-east-1 (CloudFront replicates
# from there), is published versioned (associations require a version ARN,
# so each code change cuts a new version automatically), and carries no
# environment block: Lambda@Edge rejects functions that have one, which is
# why deploy-time values travel as origin custom headers instead.
# ----------------------------------------------------------------------------

data "aws_iam_policy_document" "edge_signer_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com",
        "edgelambda.amazonaws.com",
      ]
    }
  }
}

resource "aws_iam_role" "edge_signer" {
  count = local.use_cdn ? 1 : 0

  name               = "${local.name_prefix}-edge-signer"
  assume_role_policy = data.aws_iam_policy_document.edge_signer_assume_role.json
}

# Least privilege: own log streams, plus invoking the web origin's Function
# URL - the identity whose signature the origin authorizes. Both Invoke
# actions, same post-October-2025 requirement as the CloudFront grants below.
#
# Two log statements because replicated executions do not log to the explicit
# group below: each region writes to its own
# /aws/lambda/us-east-1.<name> group, created on first execution (hence
# CreateLogGroup). The account and region wildcards are scoped by that exact
# name pattern - the only way to cover regions CloudFront chooses at runtime.
data "aws_iam_policy_document" "edge_signer" {
  count = local.use_cdn ? 1 : 0

  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.edge_signer[0].arn}:*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:log-group:/aws/lambda/us-east-1.${local.name_prefix}-edge-signer*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "lambda:InvokeFunctionUrl",
      "lambda:InvokeFunction",
    ]
    resources = [aws_lambda_function.web.arn]
  }
}

resource "aws_iam_role_policy" "edge_signer" {
  count = local.use_cdn ? 1 : 0

  name   = "${local.name_prefix}-edge-signer"
  role   = aws_iam_role.edge_signer[0].id
  policy = data.aws_iam_policy_document.edge_signer[0].json
}

# Explicit so retention is capped, like the web function's group. Lives in
# us-east-1 with the function. Replicated executions log to per-region
# /aws/lambda/us-east-1.<name> groups instead (covered by the policy above);
# those groups are CloudFront-managed, so their retention is not capped here.
resource "aws_cloudwatch_log_group" "edge_signer" {
  count = local.use_cdn ? 1 : 0

  provider          = aws.useast1
  name              = "/aws/lambda/${local.name_prefix}-edge-signer"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "edge_signer" {
  count = local.use_cdn ? 1 : 0

  provider      = aws.useast1
  function_name = "${local.name_prefix}-edge-signer"
  role          = aws_iam_role.edge_signer[0].arn

  filename         = local.edge_signer_package
  source_code_hash = filebase64sha256(local.edge_signer_package)

  runtime     = "nodejs22.x"
  handler     = "signer.handler"
  memory_size = 128
  timeout     = 5

  architectures = ["x86_64"]
  publish       = true

  depends_on = [
    aws_iam_role_policy.edge_signer,
    aws_cloudwatch_log_group.edge_signer,
  ]
}

# Function URLs created after October 2025 need both permissions; granting
# only InvokeFunctionUrl returns 403 AccessDeniedException.
resource "aws_lambda_permission" "cloudfront_invoke_function_url" {
  count = local.use_cdn ? 1 : 0

  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.web.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.web[0].arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke_function" {
  count = local.use_cdn ? 1 : 0

  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.web.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.web[0].arn
}

# Only used on LocalStack, where the Function URL stays public because there
# is no CloudFront to sign requests through.
resource "aws_lambda_permission" "public_function_url" {
  count = local.use_cdn ? 0 : 1

  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.web.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
