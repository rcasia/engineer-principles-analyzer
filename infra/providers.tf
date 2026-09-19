locals {
  use_localstack = var.localstack_endpoint != null

  # LocalStack Community cannot emulate CloudFront, so the CDN exists only
  # when targeting real AWS. Everything guarded by this is verified by
  # terraform validate in CI and end to end by scripts/check-deployed.ts on a
  # real deploy. See docs/adr/0009-cloudfront-in-front-of-lambda.md
  use_cdn        = var.localstack_endpoint == null
  name_prefix    = "principled-${var.environment}"
  lambda_package = coalesce(var.lambda_package_path, "${path.module}/build/handler.zip")
  # Bundle produced by scripts/build-edge-signer.ts. Only ever deployed when
  # a CDN is in front (LocalStack has no CloudFront and no Lambda@Edge).
  edge_signer_package = "${path.module}/build/edge-signer.zip"

  tags = {
    Project     = "principled"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Lambda@Edge functions must live in us-east-1 - the only region CloudFront
# replicates from - while everything else stays in var.aws_region (ADR-0019).
# Plain configuration, no LocalStack endpoints: no edge resource is ever
# created off real AWS (all of them are count-guarded by local.use_cdn), so
# this provider is simply unused on local runs.
provider "aws" {
  alias  = "useast1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}

provider "aws" {
  region = var.aws_region

  # LocalStack accepts any credentials and has no metadata service or STS
  # account lookup worth calling. Against real AWS all of this stays off.
  access_key                  = local.use_localstack ? "test" : null
  secret_key                  = local.use_localstack ? "test" : null
  skip_credentials_validation = local.use_localstack
  skip_metadata_api_check     = local.use_localstack
  skip_requesting_account_id  = local.use_localstack
  s3_use_path_style           = local.use_localstack

  dynamic "endpoints" {
    for_each = local.use_localstack ? [var.localstack_endpoint] : []

    content {
      cloudwatchlogs = endpoints.value
      iam            = endpoints.value
      lambda         = endpoints.value
      s3             = endpoints.value
      sts            = endpoints.value
    }
  }

  default_tags {
    tags = local.tags
  }
}
