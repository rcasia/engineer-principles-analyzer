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

Before enabling production deployment, configure the repository variables
`LEGAL_OPERATOR_NAME`, `LEGAL_PRIVACY_EMAIL` and `LEGAL_SECURITY_EMAIL`.
`LEGAL_OPERATOR_ADDRESS` is required only for economic activity under LSSI
art.10.1.a; a personal, free project without economic activity or advertising
may omit it (ADR-0043) rather than publish a home address. Terraform rejects a
real AWS deployment without name and both emails; the values are rendered on
`/imprint` and the public privacy and security pages. Do not use personal
contact details here unless the operator has chosen them for public
publication. Data-protection review (IPs, submitted source, TypeSafe US
subprocessor) is separate — see `docs/legal/README.md`.

To apply by hand against real AWS:

```sh
bun run build:lambda
terraform -chdir=infra init \
  -backend-config=backend.prod.hcl \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="region=$AWS_REGION"
terraform -chdir=infra apply -var environment=prod
```

## Jev API key

Language detection calls Jev, which needs an API key
([ADR-0028](../docs/adr/0028-jev-language-detection.md)). The key lives in
SSM Parameter Store as a `SecureString`
([ADR-0045](../docs/adr/0045-ssm-secret-for-jev-key.md)) — never in
Terraform inputs, state, or GitHub configuration, so the deploy pipeline
stays secret-free and rotation needs no redeploy. Until the real value is
set, detection runs keyless and submissions analyze as `"unknown"`.

After (or before) the first production apply, write the key once. The
parameter name is the `typesafe_api_key_ssm_parameter` output
(`/principled-prod/typesafe-api-key` for `environment=prod`):

```sh
terraform -chdir=infra output -raw typesafe_api_key_ssm_parameter
aws ssm put-parameter \
  --name "/principled-prod/typesafe-api-key" \
  --value "$TYPESAFE_API_KEY" \
  --type SecureString \
  --overwrite
```

The Lambda reads it at the next cold start — no redeploy. The same command
rotates the key later. Verify with a `POST /analyze`: the finding
provenance should name a detected language instead of `Unknown`. To run the
server locally with a key, export `TYPESAFE_API_KEY` instead; the local
stack and CI gates always run keyless by design.

## Custom domain

The stack serves the distribution's default `cloudfront.net` domain until a
custom one is switched on ([ADR-0041](../docs/adr/0041-custom-domain.md)).
To switch it on:

1. Register the domain through Route53, which creates its hosted zone in the
   same account automatically. Terraform looks the zone up and fails fast on
   a typo — it never creates the zone itself.
2. Set `CUSTOM_DOMAIN` as a repository variable to the bare domain
   (e.g. `principled.sh`). The deploy job passes it as
   `-var custom_domain=...`; every other path keeps the `null` default and
   behaves exactly as before.
3. The next deploy issues an ACM certificate in `us-east-1` (the only region
   CloudFront accepts certificates from), validates it over DNS, attaches it
   as the distribution alias, points `A`/`AAAA` alias records at the
   distribution, and 301s the default domain to the custom one via a
   CloudFront Function.

New cost is the hosted zone alone ($0.50/month): the certificate is free,
alias queries to CloudFront are free, and the redirect function sits inside
its free tier. Distribution updates take several minutes to propagate, so the
switch-on deploy is slow — that is normal.

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
| `main.tf`             | IAM role, log group, Lambda, Function URL, SSM key parameter |
| `custom-domain.tf`    | Optional apex domain: ACM cert, aliases, DNS, redirect |
| `cloudfront/`         | CloudFront Function sources (canonical-host redirect) |
| `outputs.tf`          | Public URL, function name, log group                |
| `backend.prod.hcl`    | Invariant half of the production backend config     |
| `localstack/compose.yml` | LocalStack service definition                    |
| `bootstrap/`          | One-time account setup: state bucket, OIDC, deploy role |
