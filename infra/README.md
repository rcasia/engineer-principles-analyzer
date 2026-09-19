# Infrastructure

One Lambda function on arm64, exposed by a Lambda Function URL, with a
log group capped at 7 days and an IAM role that can do nothing but write to
it. That is the entire production stack. See
[ADR-0005](../docs/adr/0005-aws-lambda-function-url.md) for why.

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

```sh
bun run build:lambda
terraform -chdir=infra init
terraform -chdir=infra apply -var environment=prod
```

State is local for now. A remote backend is needed before more than one actor
deploys — see the negative consequences in ADR-0005.

## Layout

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `versions.tf`         | Terraform and provider version constraints          |
| `providers.tf`        | Provider config, LocalStack switch, naming and tags |
| `variables.tf`        | Inputs, with validation                             |
| `main.tf`             | IAM role, log group, Lambda, Function URL           |
| `outputs.tf`          | Public URL, function name, log group                |
| `localstack/compose.yml` | LocalStack service definition                    |
