terraform {
  required_version = ">= 1.10" # S3 native state locking (use_lockfile).

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Partial configuration: the bucket and region are account specific and are
  # supplied at init time from backend.prod.hcl plus repository variables.
  # Local runs against LocalStack override this with a local backend, written
  # by scripts/tf-local.ts - see infra/README.md.
  backend "s3" {}
}
