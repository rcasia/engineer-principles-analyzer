output "state_bucket" {
  description = "Set this as the TF_STATE_BUCKET repository variable."
  value       = aws_s3_bucket.state.id
}

output "deploy_role_arn" {
  description = "Set this as the AWS_DEPLOY_ROLE_ARN repository variable. Setting it switches deployment on."
  value       = aws_iam_role.deploy.arn
}

output "aws_region" {
  description = "Set this as the AWS_REGION repository variable."
  value       = var.aws_region
}

output "next_steps" {
  description = "Commands to run after this module has been applied."
  value       = <<-EOT

    Bootstrap complete. Now configure the repository:

      gh variable set AWS_DEPLOY_ROLE_ARN --body '${aws_iam_role.deploy.arn}'
      gh variable set TF_STATE_BUCKET     --body '${aws_s3_bucket.state.id}'
      gh variable set AWS_REGION          --body '${var.aws_region}'

    Setting AWS_DEPLOY_ROLE_ARN is what switches deployment on. The next
    green commit on main will be promoted to production.
  EOT
}
