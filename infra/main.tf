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
  function_name      = aws_lambda_function.web.function_name
  authorization_type = "NONE" # Public site; there is nothing to authorise yet.
}
