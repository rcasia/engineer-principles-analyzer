# Run once per AWS account, by a human, before the pipeline can deploy.
#
# Creates the three things the delivery pipeline cannot create for itself:
#   1. the S3 bucket its Terraform state lives in
#   2. the GitHub OIDC provider
#   3. the role GitHub Actions assumes, scoped to one repository environment
#
# Everything else is created by the pipeline. See README.md.

data "aws_caller_identity" "current" {}

locals {
  oidc_url = "https://token.actions.githubusercontent.com"

  oidc_provider_arn = var.create_oidc_provider ? (
    aws_iam_openid_connect_provider.github[0].arn
    ) : (
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  )
}

# ----------------------------------------------------------------------------
# Terraform state
# ----------------------------------------------------------------------------

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # State is not reproducible. Losing it is far more expensive than the
  # pennies this bucket costs, so make it hard to delete by accident.
  lifecycle {
    prevent_destroy = true
  }
}

# Lets a corrupted or truncated state be rolled back, and is what makes S3
# native locking (use_lockfile) safe to rely on.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# State contains resource identifiers and can contain secrets. It must never
# be reachable publicly.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }

    # Lock files are tiny and short lived, but a failed run can orphan one.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

# ----------------------------------------------------------------------------
# GitHub OIDC
# ----------------------------------------------------------------------------

# thumbprint_list is deliberately omitted. It is Optional+Computed: AWS
# validates the well-known GitHub OIDC endpoint itself, so letting AWS supply
# the value avoids both a rotation problem and a perpetual diff.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = local.oidc_url
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  github_repo_owner = split("/", var.github_repository)[0]
  github_repo_name  = split("/", var.github_repository)[1]

  # GitHub started issuing immutable subject claims - which embed the numeric
  # owner and repository IDs instead of their (renameable) names - as the
  # default for every repository created on or after 2026-07-15. This
  # repository was created 2026-09-19, so it always gets the immutable
  # format; there is no opt-out. A trust policy written against the old
  # `repo:owner/repo:...` shape is a silent, permanent mismatch: AWS returns
  # "Not authorized to perform sts:AssumeRoleWithWebIdentity" and every retry
  # fails identically, because it is not a propagation delay, it is the wrong
  # string. Confirm which format a repository uses with:
  #   gh api repos/OWNER/REPO/actions/oidc/customization/sub
  github_subject = var.github_use_immutable_subject ? (
    "repo:${local.github_repo_owner}@${var.github_owner_id}/${local.github_repo_name}@${var.github_repo_id}:environment:${var.github_environment}"
    ) : (
    "repo:${var.github_repository}:environment:${var.github_environment}"
  )
}

# Fails the plan with a clear message instead of a silent, permanent
# authorization mismatch discovered later in a failed deploy.
check "github_immutable_subject_ids" {
  assert {
    condition = !var.github_use_immutable_subject || (
      var.github_owner_id != null && var.github_repo_id != null
    )
    error_message = <<-EOT
      github_use_immutable_subject is true but github_owner_id or
      github_repo_id is not set. Look them up with:
        gh api repos/${var.github_repository} -q '.owner.id, .id'
    EOT
  }
}

data "aws_iam_policy_document" "deploy_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to the environment, not to a branch. Any workflow can run on
    # main; only a job that declares `environment: production` can assume
    # this role, which is what GitHub environment protection rules gate.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_subject]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.resource_prefix}-github-deploy"
  description        = "Assumed by GitHub Actions to deploy ${var.github_repository}."
  assume_role_policy = data.aws_iam_policy_document.deploy_assume_role.json

  # A deploy that hangs should lose its credentials, not keep them for hours.
  max_session_duration = 3600
}

# ----------------------------------------------------------------------------
# What the deploy role may do
# ----------------------------------------------------------------------------

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "TerraformState"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.state.arn]
  }

  statement {
    sid    = "TerraformStateObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.state.arn}/*"]
  }

  # The stack provisions its own Lambda execution role, so the deploy role
  # needs IAM write access. It is restricted to the project's name prefix so
  # it cannot touch unrelated roles in the account.
  statement {
    sid    = "ProjectRoles"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:PassRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRoleTags",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:UpdateAssumeRolePolicy",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.resource_prefix}-*",
    ]
  }

  statement {
    sid    = "ProjectFunctions"
    effect = "Allow"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:GetFunctionCodeSigningConfig",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:ListVersionsByFunction",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags",
      "lambda:CreateFunctionUrlConfig",
      "lambda:DeleteFunctionUrlConfig",
      "lambda:GetFunctionUrlConfig",
      "lambda:UpdateFunctionUrlConfig",
      "lambda:GetPolicy",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:PutFunctionConcurrency",
      "lambda:DeleteFunctionConcurrency",
      # Associating a Lambda@Edge function for the first time makes
      # CloudFront enable replication on it; the caller needs this or
      # UpdateDistribution fails with AccessDenied (ADR-0019). Needed once
      # per function, kept permanently like the rest of this statement.
      "lambda:EnableReplication*",
      # The edge signer is published versioned (associations require a
      # version ARN), so every code change publishes - same failure shape
      # as above if missing.
      "lambda:PublishVersion",
    ]
    resources = ["arn:aws:lambda:*:*:function:${var.resource_prefix}-*"]
  }

  statement {
    sid    = "ProjectLogGroups"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:PutRetentionPolicy",
      "logs:DeleteRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
      "logs:ListTagsForResource",
    ]
    resources = ["arn:aws:logs:*:*:log-group:/aws/lambda/${var.resource_prefix}-*"]
  }

  # DescribeLogGroups cannot be scoped to a single group; Terraform uses it to
  # read current state. It is read only.
  statement {
    sid       = "ReadLogGroups"
    effect    = "Allow"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }

  # ADR-0045: the deploy manages the Jev key's SSM parameter — its name and
  # tags only. The value is set out of band and ignored by Terraform
  # (`ignore_changes`), but creating and reading a SecureString still needs
  # the parameter and KMS actions. Scoped to this project's parameter prefix
  # (the stack names it `/principled-<environment>/...`, which shares the
  # bootstrap prefix by the same convention as the Lambda and IAM statements
  # above) and to the default `aws/ssm` key: no customer-managed key, no
  # extra cost.
  statement {
    sid    = "JevKeyParameter"
    effect = "Allow"
    actions = [
      "ssm:PutParameter",
      "ssm:GetParameter",
      "ssm:DeleteParameter",
      "ssm:AddTagsToResource",
      "ssm:RemoveTagsFromResource",
      "ssm:ListTagsForResource",
    ]
    resources = ["arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.resource_prefix}-*"]
  }

  statement {
    sid    = "JevKeyKms"
    effect = "Allow"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:DescribeKey",
    ]
    resources = ["arn:aws:kms:*:${data.aws_caller_identity.current.account_id}:alias/aws/ssm"]
  }

  # CloudFront distribution ARNs contain a generated ID, not a name, so they
  # cannot be matched by prefix the way the Lambda and IAM statements are.
  # This is the least scoped statement in the policy; see README.md.
  # Function actions join it for ADR-0041's canonical-host redirect: function
  # ARNs carry the same generated distribution ID once attached.
  statement {
    sid    = "Cdn"
    effect = "Allow"
    actions = [
      "cloudfront:CreateDistribution",
      "cloudfront:UpdateDistribution",
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:DeleteDistribution",
      "cloudfront:ListDistributions",
      "cloudfront:TagResource",
      "cloudfront:UntagResource",
      "cloudfront:ListTagsForResource",
      "cloudfront:CreateOriginAccessControl",
      "cloudfront:UpdateOriginAccessControl",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:GetOriginAccessControlConfig",
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:ListOriginAccessControls",
      "cloudfront:CreateInvalidation",
      "cloudfront:CreateFunction",
      "cloudfront:UpdateFunction",
      "cloudfront:DescribeFunction",
      "cloudfront:GetFunction",
      "cloudfront:DeleteFunction",
      "cloudfront:PublishFunctionVersion",
      "cloudfront:ListFunctions",
      # Read only: resolves the managed cache and header policies by name.
      "cloudfront:GetCachePolicy",
      "cloudfront:ListCachePolicies",
      "cloudfront:GetOriginRequestPolicy",
      "cloudfront:ListOriginRequestPolicies",
      "cloudfront:GetResponseHeadersPolicy",
      "cloudfront:ListResponseHeadersPolicies",
    ]
    resources = ["*"]
  }

  # ADR-0041's custom domain: the deploy provisions the ACM certificate and
  # its Route53 validation and alias records. Certificate ARNs embed the
  # account plus a generated ID and hosted-zone IDs are generated too, so
  # neither can be prefix-scoped to this project the way the Lambda and IAM
  # statements are - same accepted tradeoff as the Cdn statement above.
  statement {
    sid    = "CustomDomain"
    effect = "Allow"
    actions = [
      "acm:RequestCertificate",
      "acm:DescribeCertificate",
      "acm:DeleteCertificate",
      "acm:ListCertificates",
      "acm:AddTagsToCertificate",
      "acm:RemoveTagsFromCertificate",
      "acm:ListTagsForCertificate",
      "route53:ListHostedZones",
      "route53:GetHostedZone",
      "route53:ListResourceRecordSets",
      "route53:GetChange",
      "route53:ChangeResourceRecordSets",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${var.resource_prefix}-github-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
