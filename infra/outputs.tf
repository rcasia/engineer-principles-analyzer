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

output "custom_domain" {
  description = "The custom domain serving the site (ADR-0041), or empty when disabled."
  value       = local.custom_domain_enabled ? var.custom_domain : ""
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

output "typesafe_api_key_ssm_parameter" {
  description = "SSM SecureString parameter holding the Jev API key (ADR-0045). A name, not a value. Terraform creates it with a placeholder and never manages the value: set the real key out of band, e.g. aws ssm put-parameter --name <this> --value \"$KEY\" --type SecureString --overwrite. Empty on LocalStack, which runs keyless."
  value       = local.use_cdn ? aws_ssm_parameter.typesafe_api_key[0].name : ""
}
