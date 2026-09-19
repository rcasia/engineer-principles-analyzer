# Infrastructure

CloudFront in front of one arm64 Lambda exposed by a Function URL, with a log
group capped at 7 days and an IAM role that can do nothing but write to it.
That is the entire production stack. See
[ADR-0005](../docs/adr/0005-aws-lambda-function-url.md) for the compute
choice and [ADR-0009](../docs/adr/0009-cloudfront-in-front-of-lambda.md) for
the CDN.

The Function URL requires `AWS_IAM` on real AWS and is reachable only through
CloudFront, which signs requests with origin access control. On LocalStack
there is no CloudFront, so the Function URL is public there instead — this is
the one place local and production configuration differ.

The same configuration targets LocalStack or real AWS. Setting
`localstack_endpoint` redirects every AWS call and skips credential checks;
leaving it null targets AWS.

## Verify without an AWS account

`terraform plan` needs no credentials at all:

```sh
bun run infra:validate
bun run infra:plan
```

## Apply against LocalStack

Requires a running Docker daemon.

```sh
bun run localstack:up      # start LocalStack, wait for health
bun run infra:apply:local  # build the bundle, then terraform apply
curl "$(terraform -chdir=infra output -raw web_url)"
bun run infra:destroy:local
bun run localstack:down
```

## Deploy to AWS

Deployment is automatic: every green commit on main is promoted to
production. Before that can work, run the one-time setup in
[`bootstrap/`](bootstrap/README.md), which creates the state bucket, the
GitHub OIDC provider and the deploy role.

Until `AWS_DEPLOY_ROLE_ARN` is set as a repository variable the deploy job is
skipped, so the pipeline stays green without an AWS account.

To apply by hand against real AWS:

```sh
bun run build:lambda
terraform -chdir=infra init \
  -backend-config=backend.prod.hcl \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="region=$AWS_REGION"
terraform -chdir=infra apply -var environment=prod
```

## State

Production state lives in S3 with native locking ([ADR-0007](../docs/adr/0007-remote-terraform-state.md)).
`versions.tf` declares a **partial** backend; `backend.prod.hcl` holds the
invariant settings and the bucket and region are passed at `init`.

LocalStack runs must not touch that bucket, so `scripts/tf-local.ts` writes a
gitignored `backend_override.tf` selecting the local backend. Use the
`infra:*:local` scripts rather than calling `terraform` directly in this
directory — a bare `terraform apply` here targets **production**.

## Layout

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `versions.tf`         | Terraform and provider version constraints          |
| `providers.tf`        | Provider config, LocalStack switch, naming and tags |
| `variables.tf`        | Inputs, with validation                             |
| `main.tf`             | IAM role, log group, Lambda, Function URL           |
| `outputs.tf`          | Public URL, function name, log group                |
| `backend.prod.hcl`    | Invariant half of the production backend config     |
| `localstack/compose.yml` | LocalStack service definition                    |
| `bootstrap/`          | One-time account setup: state bucket, OIDC, deploy role |
