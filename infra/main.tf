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

  depends_on = [
    aws_iam_role_policy.web_logging,
    aws_cloudwatch_log_group.web,
  ]
}

resource "aws_lambda_function_url" "web" {
  function_name = aws_lambda_function.web.function_name

  # Private behind CloudFront on real AWS, so the CDN cannot be bypassed.
  # Public on LocalStack, which has no CloudFront to sign requests through.
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
# the Lambda free tier cannot be burned through directly.
# ----------------------------------------------------------------------------

locals {
  # "https://abc123.lambda-url.eu-west-1.on.aws/" -> "abc123.lambda-url.eu-west-1.on.aws"
  function_url_host = trimsuffix(
    trimprefix(aws_lambda_function_url.web.function_url, "https://"),
    "/",
  )
  origin_id = "${local.name_prefix}-web-lambda"
}

# Managed policies, read only when the CDN is built. Guarding them with count
# matters: LocalStack cannot serve these lookups.
data "aws_cloudfront_cache_policy" "use_origin_cache_control" {
  count = local.use_cdn ? 1 : 0
  name  = "UseOriginCacheControlHeaders"
}

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

resource "aws_cloudfront_origin_access_control" "web" {
  count = local.use_cdn ? 1 : 0

  name                              = "${local.name_prefix}-web"
  description                       = "Signs CloudFront requests to the web Lambda function URL."
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
    domain_name              = local.function_url_host
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.web[0].id

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
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.use_origin_cache_control[0].id
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
