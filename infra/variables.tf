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

variable "custom_domain" {
  description = <<-EOT
    Optional apex domain (e.g. "principled.sh") served by the CloudFront
    distribution in addition to its default domain (ADR-0041). Leave null and
    the stack behaves exactly as before. The domain's Route53 hosted zone must
    already exist in the same account - registering through Route53 creates it
    automatically. Only used on real AWS: LocalStack has no CloudFront, so the
    variable is ignored there. Enabled in production by setting the
    CUSTOM_DOMAIN repository variable (see .github/workflows/main.yml).
  EOT
  type        = string
  default     = null

  validation {
    condition     = var.custom_domain == null || can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$", var.custom_domain))
    error_message = "custom_domain must be null or a bare domain like \"principled.sh\" (no scheme, no path)."
  }
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

variable "legal_operator_name" {
  description = "Legal name of the operator, published on the web imprint. Required for real AWS deployments."
  type        = string
  default     = null
  nullable    = true
}

variable "legal_operator_address" {
  description = <<-EOT
    Domicile published on the web imprint. Required for economic activity
    under LSSI art.10.1.a; omit it (null or blank) for a personal, free
    project without economic activity or advertising, which is outside that
    scope (ADR-0043). Never publish a home address unless chosen for public
    publication.
  EOT
  type        = string
  default     = null
  nullable    = true
}

variable "legal_privacy_email" {
  description = "Privacy contact address published on the web legal pages. Required for real AWS deployments."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.legal_privacy_email == null || can(regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", var.legal_privacy_email))
    error_message = "legal_privacy_email must be null or a valid email address."
  }
}

variable "legal_security_email" {
  description = "Security disclosure address published on the web legal pages. Required for real AWS deployments."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.legal_security_email == null || can(regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", var.legal_security_email))
    error_message = "legal_security_email must be null or a valid email address."
  }
}
