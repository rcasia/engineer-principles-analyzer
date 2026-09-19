output "web_url" {
  description = "Public URL of the web adapter."
  value       = aws_lambda_function_url.web.function_url
}

output "function_name" {
  description = "Name of the deployed Lambda function."
  value       = aws_lambda_function.web.function_name
}

output "log_group" {
  description = "CloudWatch log group for the web adapter."
  value       = aws_cloudwatch_log_group.web.name
}
