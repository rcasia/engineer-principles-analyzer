# ADR-0019: Sign CloudFront origin requests with Lambda@Edge so POST works

**Status**: Accepted (resolves the `POST /analyze` gap recorded in [ADR-0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) and AGENTS.md)
**Date**: 2026-09-19

## Context

`POST /analyze` (#34) cannot work through the stack as it stood, for two
independent reasons that together close off every obvious option:

1. **Origin access control cannot sign a POST body.** OAC signs SigV4
   headers but never the `x-amz-content-sha256` payload hash, so an
   `AWS_IAM` Function URL rejects every POST with a signature mismatch.
   ADR-0004 (no client-side JavaScript) rules out having the browser supply
   the hash.
2. **This account's Organization blocks unauthenticated Function URL
   invocation account-wide** (ADR-0018), regardless of the function's own
   `AuthType` or resource policy - proven with a trivial isolated function,
   no CloudFront and no application code involved. So ADR-0017's
   `AuthType NONE` + shared-secret origin cannot work here either.

What remains must therefore keep `AWS_IAM` on the Function URL (satisfying
the SCP, since every invocation is authenticated) while producing a *valid*
signature over the POST body (satisfying Lambda). The only party able to do
both, with no client JavaScript, is compute sitting between CloudFront and
the origin that holds IAM credentials: a Lambda@Edge origin-request
function.

This was **proven in isolation before being built**: a scratch stack
(trivial `AWS_IAM` origin in eu-west-1, hand-rolled SigV4 signer in
us-east-1, scratch distribution with no OAC) returned 200 for both GET and
POST through CloudFront, then was fully deleted. The spike also established
three implementation facts used below: Lambda@Edge forbids environment
variables, `nodejs22.x` works, and associations require a published version
ARN.

## Decision Drivers

- **`POST /analyze` must work on real AWS**, with bodies too large for a
  query string, so it cannot become a `GET`.
- **No client-side JavaScript** (ADR-0004) and **no public Function URL**
  (Organization SCP, ADR-0018) - both alternatives are closed, not just
  disliked.
- **Don't take production down again.** The ADR-0017 migration failed
  twice, once by deleting invoke permissions before the distribution
  updated and once by racing an OAC delete against the distribution still
  referencing it. Whatever this changes must apply in an order that cannot
  strand CloudFront without a working origin auth path.
- **Keep the LocalStack gate meaningful.** Edge resources exist only on
  real AWS; everything else must still verify locally unchanged.

## Considered Options

### Option 1: Lambda@Edge origin-request signer (chosen)

- **Pros**: Keeps `AWS_IAM` + the Function URL architecture (no ADR-0005
  reversal). Signs the full request, body included, with its own
  credentials - works identically for GET and POST. Spike-proven 200/200 in
  this exact account. No new per-request billed service beyond edge
  invocations themselves.
- **Cons**: us-east-1 only, so Terraform gains a second provider and
  region. Associations need a published version ARN, so every signer change
  cuts a new version (automatic via `publish = true`). No environment
  variables - deploy-time values travel as origin custom headers. Replicated
  executions log per-region outside Terraform-managed retention. Untestable
  on LocalStack beyond "everything else still works"; the CDN path is
  verified by `terraform validate` + `check-deployed.ts` on real deploys,
  the same accepted gap as all CDN configuration.

### Option 2: API Gateway HTTP API in front of Lambda

- **Pros**: Single region, standard Terraform, one place for logs, no
  versioning dance. CloudFront to API Gateway is plain HTTPS with no
  signing problem at all, and the SCP does not apply (API Gateway invokes
  via IAM, not Function URLs).
- **Cons**: Reverses ADR-0005's cost rationale (~$1/M requests - cheap, but
  a reversal needs its own justification, not a side effect). Bigger blast
  radius: new resource type, a different event shape through the Lambda
  adapter, and changes to the LocalStack flow that currently works.

### Option 3: Leave POST broken

- **Pros**: Zero risk, zero work.
- **Cons**: Leaves #34's feature broken on production indefinitely, which
  is the incident that started all of this. Rejected.

## Decision

Adopt **Option 1**. Concretely:

- New `packages/edge-signer` package: pure `node:crypto` SigV4 (`signer.ts`),
  thin `index.ts` entry shim (excluded from mutation like other composition
  roots), unit tests including the official AWS `get-vanilla` vector, a
  WebCrypto differential cross-check, and fail-closed cases. No SDK, no
  dependencies at all.
- `scripts/build-edge-signer.ts` bundles it to `infra/build/edge-signer.zip`
  as **CommonJS** (spike-proven; ESM handler support on Lambda@Edge is not
  something to discover in production). CI builds it right after the main
  bundle, before apply.
- Terraform: `aws.useast1` provider alias; edge role assumable by
  `lambda.amazonaws.com` **and** `edgelambda.amazonaws.com` with least
  privilege (own logs + `InvokeFunctionUrl`/`InvokeFunction` on the web
  origin); versioned `nodejs22.x` function (128MB, 5s timeout); an
  `origin-request` association with `include_body = true` on the default
  cache behavior; `x-origin-host`/`x-origin-region` origin custom headers
  carrying the deploy-time values the signer cannot get from environment.
- The deploy role (`infra/bootstrap`) gains `lambda:EnableReplication*`
  scoped to the project's functions: associating an edge function for the
  first time makes CloudFront enable replication on it, and the first real
  deploy failed on exactly that missing permission. Because bootstrap keeps
  local state and cannot be re-applied from CI, the identical statement was
  applied to the live role by hand first and recorded here second - config
  and reality match, so a future bootstrap apply converges to no-op.
- The distribution origin drops `origin_access_control_id` in this deploy
  while the OAC **resource is retained**, unreferenced - the same detach
  pattern that worked in `4433f27`. The CloudFront invoke permissions stay
  too. A follow-up commit deletes both leftovers once this has propagated.
- The signer fails closed: missing host/region headers, truncated bodies,
  or absent credentials produce a 403 edge response instead of forwarding
  unsigned. A viewer-supplied header of the same name as a scaffolding
  header can only yield a signature for a host the origin itself rejects.
- `scripts/check-deployed.ts` re-asserts `200` for `POST /analyze` through
  the CDN - the check that caught the original incident class.
- ADR-0017's application-level origin-secret check is **removed**
  (`server.ts`, its tests, `index.ts`, `lambda-entry.ts`): with IAM gating
  the origin again it authenticates nothing, and dead security code is
  worse than none. Its Fail-closed tests are replaced by the signer's own.

## Consequences

### Positive

- `POST /analyze` works on real AWS with no client JavaScript and no
  public Function URL - the first configuration satisfying all three
  constraints at once.
- The signing logic is the most verified code in the edge path: official
  spec vectors, an independent-algorithm cross-check, 100% mutation score,
  plus a live end-to-end spike before it was built.
- Request flow stays single-origin, single-region (plus the mandatory
  us-east-1 signer): no new service type, no ADR-0005 reversal, LocalStack
  flow untouched.

### Negative

- **A second region to operate.** The signer lives in us-east-1 while
  everything else is in eu-west-1. Non-negotiable (CloudFront's rule), but
  it is real complexity in `providers.tf` and in incident response.
- **Version-per-change.** Every signer edit publishes a new version and
  updates the association; there is no `$LATEST` shortcut for edge
  associations. Deploys touching the signer are slower.
- **Logs scatter.** Replicated executions log per-region under
  CloudFront-managed groups; only us-east-1 retention is capped by this
  stack.
- **Still outside the LocalStack gate**, like all CDN configuration. The
  signer *logic* is unit-tested; the *wiring* is proven only by real
  deploys.
- **Lambda@Edge has no free tier** (currently $0.60/M requests plus
  compute). At this traffic that is cents; it is nonetheless the first
  component in this stack that is not free at small scale.
- **1MB body visibility limit**: CloudFront truncates bodies larger than
  ~1MB to edge functions (`inputTruncated`), which this signer refuses
  with 403. Single source files realistically stay far below that; a
  multi-megabyte upload would need chunking or a different path.

### Risks and mitigations

- *Risk*: the distribution update strands CloudFront mid-migration again.
  *Mitigation*: nothing is deleted in this deploy (OAC resource and
  CloudFront permissions stay); the update only *adds* the association and
  swaps the origin auth reference. Deletion is a separate follow-up.
- *Risk*: the signer has a bug and every origin request 403s.
  *Mitigation*: `check-deployed.ts` asserts 200 for GET, 404, direct-origin
  403, *and* POST 200 on every real deploy - a broken signer fails the
  deploy, not silently. The fail-closed 403s are `no-store`, so no bad
  response is cached.
- *Risk*: signer cold starts add edge latency to every request.
  *Mitigation*: 2kB bundle, crypto-only, no SDK init; measured in
  single-digit milliseconds warm. Accepted.
