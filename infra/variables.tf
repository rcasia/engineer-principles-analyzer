variable "aws_region" {
  description = "Region the stack is deployed into."
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment environment. Part of every resource name."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z0-9-]{2,16}$", var.environment))
    error_message = "environment must be 2-16 lowercase letters, digits or dashes."
  }
}

variable "localstack_endpoint" {
  description = <<-EOT
    When set, every AWS call is pointed at this LocalStack endpoint and
    credential validation is skipped. Leave null to target real AWS.
  EOT
  type        = string
  default     = null
}

variable "lambda_package_path" {
  description = "Zip built by scripts/build-lambda.ts. Defaults to infra/build/handler.zip."
  type        = string
  default     = null
}

variable "edge_signer_package_path" {
  description = "Zip built by scripts/build-edge-signer.ts. Defaults to infra/build/edge-signer.zip."
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention. Kept short: logs are the main way this stack can cost money."
  type        = number
  default     = 7
}

variable "typesafe_api_key" {
  description = <<-EOT
    TypeSafe API key for Jev language detection (ADR-0028), injected as the
    TYPESAFE_API_KEY environment variable of the web Lambda. Leave null and
    the function still starts: submissions are reported as undetectable
    (ADR-0037). LocalStack and the CI gate run keyless by design.
  EOT
  type        = string
  sensitive   = true
  default     = null

  validation {
    condition     = var.typesafe_api_key == null || trimspace(var.typesafe_api_key) != ""
    error_message = "typesafe_api_key must be null or a non-blank key."
  }
}
