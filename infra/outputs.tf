output "web_url" {
  description = "Public URL of the site. The CloudFront domain on real AWS, the Function URL on LocalStack."
  value = local.use_cdn ? (
    "https://${aws_cloudfront_distribution.web[0].domain_name}/"
  ) : aws_lambda_function_url.web.function_url
}

output "origin_url" {
  description = "The Lambda Function URL. Behind CloudFront this must reject direct access."
  value       = aws_lambda_function_url.web.function_url
}

output "cdn_enabled" {
  description = "Whether a CloudFront distribution fronts the function."
  value       = local.use_cdn
}

output "function_name" {
  description = "Name of the deployed Lambda function."
  value       = aws_lambda_function.web.function_name
}

output "log_group" {
  description = "CloudWatch log group for the web adapter."
  value       = aws_cloudwatch_log_group.web.name
}
