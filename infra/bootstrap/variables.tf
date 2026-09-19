variable "aws_region" {
  description = "Region for the state bucket. Must match the region used at terraform init."
  type        = string
  default     = "eu-west-1"
}

variable "state_bucket_name" {
  description = <<-EOT
    Globally unique name for the Terraform state bucket, for example
    "epa-tfstate-a1b2c3". S3 bucket names are global, so this cannot have a
    sensible default.
  EOT
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "state_bucket_name must be a valid S3 bucket name (3-63 chars, lowercase)."
  }
}

variable "github_repository" {
  description = "Repository allowed to assume the deploy role, as \"owner/name\"."
  type        = string
  default     = "rcasia/principled"

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repository))
    error_message = "github_repository must be in the form \"owner/name\"."
  }
}

variable "github_use_immutable_subject" {
  description = <<-EOT
    Whether this repository's OIDC tokens use GitHub's immutable subject
    claim format (owner and repo referenced by numeric ID, not by name).
    Mandatory and non-optional for every repository created on or after
    2026-07-15; existing repositories keep the old name-based format unless
    they explicitly opt in. Check with:
      gh api repos/OWNER/REPO/actions/oidc/customization/sub
    A mismatch here does not fail loudly - AWS returns the same
    "Not authorized to perform sts:AssumeRoleWithWebIdentity" error as an
    unpropagated role, except retrying never fixes it.
  EOT
  type        = bool
  default     = true
}

variable "github_owner_id" {
  description = <<-EOT
    Numeric ID of the repository owner, required when
    github_use_immutable_subject is true. Look it up with:
      gh api repos/OWNER/REPO -q '.owner.id'
    Defaults to rcasia's account ID; override this on a fork.
  EOT
  type        = string
  default     = "31012661"
}

variable "github_repo_id" {
  description = <<-EOT
    Numeric ID of the repository itself, required when
    github_use_immutable_subject is true. Look it up with:
      gh api repos/OWNER/REPO -q '.id'
    Defaults to this repository's ID; override this on a fork, since forking
    creates a new repository with a new ID.
  EOT
  type        = string
  default     = "1376952661"
}

variable "github_environment" {
  description = <<-EOT
    GitHub Environment the deploy role is scoped to. The trust policy allows
    only this environment, not any workflow on a branch, so a job must run
    with `environment: <this>` to obtain credentials.
  EOT
  type        = string
  default     = "production"
}

variable "create_oidc_provider" {
  description = <<-EOT
    Create the GitHub OIDC provider. An AWS account can only have one provider
    per URL, so set this to false if another stack in this account already
    created it.
  EOT
  type        = bool
  default     = true
}

variable "resource_prefix" {
  description = "Prefix of the resources the deploy role is allowed to manage."
  type        = string
  default     = "epa"
}

variable "noncurrent_version_expiration_days" {
  description = "How long superseded state versions are kept. Bounds the only recurring cost of this module."
  type        = number
  default     = 90
}
