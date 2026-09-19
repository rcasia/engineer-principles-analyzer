terraform {
  required_version = ">= 1.10" # S3 native state locking (use_lockfile).

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Deliberately no backend: this module creates the bucket the main stack
  # stores its state in, so it cannot store its own state there. See the
  # "If you lose this state" section of README.md.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "principled"
      Component = "bootstrap"
      ManagedBy = "terraform"
    }
  }
}
