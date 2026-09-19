# Invariant half of the production backend configuration. The bucket and
# region are account specific and are passed as -backend-config flags from
# the TF_STATE_BUCKET and AWS_REGION repository variables.
#
#   terraform -chdir=infra init \
#     -backend-config=backend.prod.hcl \
#     -backend-config="bucket=$TF_STATE_BUCKET" \
#     -backend-config="region=$AWS_REGION"

key     = "prod/terraform.tfstate"
encrypt = true

# S3 native locking. Replaces the DynamoDB lock table the older docs describe,
# which is one fewer resource to provision and pay for.
use_lockfile = true
