# ADR-0005: Deploy to AWS Lambda behind a Function URL, verified on LocalStack

**Status**: Accepted. The "no CloudFront" part is superseded by
[ADR-0009](0009-cloudfront-in-front-of-lambda.md), which found the cost
premise behind it to be wrong. The Lambda, Function URL, runtime and
LocalStack decisions here still stand.
**Date**: 2026-09-19

## Context

The project needs infrastructure as code, must be **low cost by design**, and
is **agentic first**. Those three pull in the same direction: an agent must be
able to change infrastructure and get real feedback, and the running cost at
zero traffic must be zero.

Two questions had to be answered together, because the local story constrains
the cloud choice:

1. What do we deploy onto?
2. How does anyone verify a change without an account, credentials or spend?

## Decision Drivers

- **Zero cost at zero traffic.** No hourly billing, no idle capacity.
- **Infrastructure must be verifiable without credentials.** Secrets in CI for
  a public repository is a risk we do not need to take to run a test.
- **Few moving parts** (ADR-0001).

## Considered Options

### Cloud target

**Option A: Lambda + Function URL.** Lambda's 1M requests and 400k GB-seconds
per month are perpetual, not a 12-month trial. Function URLs cost nothing on
top. arm64 is ~20% cheaper per GB-second. At our traffic the bill is $0, and
the only thing that can spend money is CloudWatch log retention, which is
capped at 7 days.

**Option B: Lambda + API Gateway.** Billed per request from the first one, and
buys routing, authorisers and usage plans we do not use. Rejected as cost with
no benefit.

**Option C: Cloudflare Workers.** Comparable or better free tier, genuinely
cheap. Rejected only because there is no credible local emulator that
Terraform can apply against; verification would require a real account and an
API token in CI, which is exactly what driver 2 rules out.

**Option D: A container on a small VM.** Predictable, familiar. Rejected: it
bills by the hour whether or not anyone visits.

### Runtime

**Option A: managed `nodejs22.x`, bundled by Bun.** Bun is the bundler,
`--target=node --format=esm` emits a single `handler.mjs`. No layer to build.

**Option B: `provided.al2023` with a custom Bun layer.** Runs Bun in
production, matching local. Costs a layer to build, version and keep patched.
Rejected: ADR-0001's "few moving parts" outweighs runtime symmetry, and
nothing in the app depends on Bun-only APIs at runtime.

### Local and CI verification

**Option A: LocalStack.** The same `infra/` is applied against a container.
Verified working: `terraform apply` creates all 5 resources and the resulting
Function URL returns the real rendered page.

**Option B: `terraform plan` only.** Catches syntax, not behaviour. Kept as
the cheap gate, but not sufficient on its own.

## Decision

Deploy **one Lambda function on arm64 running `nodejs22.x`, exposed by a
Lambda Function URL**, with an explicit CloudWatch log group at 7-day
retention and an IAM role scoped to writing that group only.

Target **LocalStack** for local and CI verification. The provider takes a
`localstack_endpoint` variable; when it is set, endpoints are redirected and
credential validation is skipped. When it is null the same configuration
targets real AWS. There is no separate local copy of the infrastructure.

## Consequences

### Positive

- Running cost at current traffic is $0, and the stack has no idle component.
- `terraform plan` runs with **no credentials at all** (verified), so it gates
  every push in a public repository without secrets.
- `terraform apply` against LocalStack exercises IAM, Lambda packaging and the
  Function URL for real, and the deployed function was confirmed to serve the
  page and return 404 correctly.
- One Lambda and one URL is a small enough surface for an agent to reason
  about.

### Negative

- Cold starts are user-visible on a low-traffic site. Not addressed;
  provisioned concurrency would cost money and defeat the point.
- LocalStack is an emulation, not AWS. It raises confidence, it does not
  guarantee parity — IAM enforcement in particular is far more permissive.
- Production runs Node while development runs Bun. The bundle is smoke-tested
  under Node in CI to keep that gap visible.
- State is currently local. A remote backend is required before more than one
  actor deploys.

### Risks and mitigations

- *Risk*: A public Function URL (`authorization_type = "NONE"`) is open to the
  internet and Lambda bills beyond the free tier.
  *Mitigation*: Accepted while the site is public and read-only with no
  per-request cost of its own. Before anything expensive sits behind it, add a
  budget alarm and reserved concurrency. Tracked as a follow-up.
- *Risk*: LocalStack parity drift hides a failure that only appears in AWS.
  *Mitigation*: Promotion to prod is a real `terraform apply` against AWS with
  a plan reviewed in CI; LocalStack gates the change, it does not bless it.
