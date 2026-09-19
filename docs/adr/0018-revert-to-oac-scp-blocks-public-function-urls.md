# ADR-0018: Revert to origin access control — an Organization SCP blocks public Function URLs

**Status**: Accepted (supersedes [ADR-0017](0017-shared-secret-origin-instead-of-oac.md); restores [ADR-0009](0009-cloudfront-in-front-of-lambda.md)'s original mechanism)
**Date**: 2026-09-19

## Context

ADR-0017 replaced origin access control (OAC) with `AuthType NONE` plus a
shared secret header, specifically so `POST /analyze` (#34) would work
through CloudFront — OAC cannot sign a POST body, so an `AWS_IAM` Function
URL rejects every POST with a SigV4 mismatch, and ADR-0004 rules out a
client-side fix.

Deploying that change **took production down entirely**, in two stages:

1. The first apply destroyed the CloudFront→Lambda invoke permissions before
   updating the distribution (a `for_each` on an unknown value produced an
   inconsistent plan, and removing the OAC attribute reference dropped the
   dependency edge that would have ordered the update first), leaving
   CloudFront unable to invoke the origin at all — every request, GET
   included, started returning 403.
2. A follow-up apply fixed both bugs and completed successfully — Terraform
   confirmed `AuthType: NONE`, a correct public resource policy, the
   distribution migrated off OAC, `Status: Deployed`. **Every request still
   returned 403.**

Diagnosis (using read-only AWS CLI access against the real account) found:

- The Function URL's live config and resource policy were exactly as
  Terraform intended.
- Invoking the function directly through the IAM `Invoke` API (bypassing the
  Function URL's HTTP layer) succeeded and ran our own code correctly.
- Invoking the Function URL's HTTPS endpoint directly — no CloudFront in the
  path — still returned Lambda's own generic
  `"Forbidden. For troubleshooting Function URL authorization issues..."`,
  meaning the request was denied **before reaching our code**, despite
  `AuthType: NONE`.
- `aws organizations describe-organization` showed this account is a
  **member of an AWS Organization** with Service Control Policies enabled,
  managed by a separate account. Member-account root cannot list the SCPs
  applied to itself (`ListPoliciesForTarget` → `AccessDeniedException`).

That combination — correct `NONE` config, correct resource policy, a
healthy function, yet still blocked at the URL's own auth gate — cannot be
explained by anything this repository's Terraform or application code
controls. It is the signature of an **Organization-level guardrail blocking
unauthenticated Lambda Function URL invocation account-wide**, which
overrides whatever the function's own `AuthType`/policy says, and which is
not visible or editable from this account.

## Decision Drivers

- **Restore service immediately.** The failed migration left production
  fully down (not just POST — GET too), which is strictly worse than the
  original incident.
- **Don't retry a mechanism proven impossible.** A public Function URL
  cannot work in this AWS account regardless of configuration; no amount of
  Terraform or application changes fixes an Organization-level block we
  cannot see or edit.
- **Stay honest about what's fixed and what isn't.** Reverting restores
  `GET /` and the rest of the site; it does not fix `POST /analyze`, which
  goes back to the SigV4-mismatch 403 that started this whole chain.

## Considered Options

### Option 1: Get the SCP loosened from the management account

- **Pros**: Would let ADR-0017's shared-secret approach actually work as
  designed — the mechanism itself was sound.
- **Cons**: Requires access to a separate management account
  (`149828427012`) not available to this repository or its deploy role.
  Not something to wait on with production down.

### Option 2: Revert to OAC (`AWS_IAM`), accept POST is broken

- **Pros**: Restores exactly the configuration that was working before #34
  ever touched infrastructure — the smallest, best-understood change
  available. No new unknowns; ADR-0009's reasoning and its own documented
  incident already cover this mechanism thoroughly.
- **Cons**: `POST /analyze` goes back to failing on real AWS. The feature
  built in #34 stays broken there (LocalStack, with no CDN and no signing,
  is unaffected and still exercises the route in CI).

### Option 3: Lambda@Edge origin-request function to sign the payload

- **Pros**: Would let `AWS_IAM` + OAC support POST properly, closing the gap
  Option 2 leaves open.
- **Cons**: Real infrastructure to design, build and verify — not an
  emergency-restore action. Worth doing as a follow-up, not as this commit.

## Decision

**Revert to Option 2.** `authorization_type` goes back to
`local.use_cdn ? "AWS_IAM" : "NONE"`, the origin access control resource is
reattached to the distribution's `origin_access_control_id`, the two
`cloudfront.amazonaws.com` invoke permissions are restored, and
`aws_lambda_permission.public_function_url` goes back to LocalStack-only.
The shared secret, the custom header, and the Lambda environment variable
are all removed — the `random` provider is no longer needed at all.

`AllowedMethods` keeps the full set from b15393c (harmless: CloudFront still
needs it to pass a POST through to the origin at all, even though the origin
then rejects it — that rejection is a useful, specific error rather than a
generic CloudFront one).

`scripts/check-deployed.ts` drops its `POST /analyze` assertion: it would
fail every real deploy until this is actually fixed, and this file's whole
purpose is to prove real behaviour, not assert something known to be false.
The gap is recorded in `AGENTS.md`'s "Known gaps" instead, where it stays
visible without blocking every deploy.

The application-level origin-secret check added in ADR-0017
(`server.ts`'s `originSecret`/`ORIGIN_VERIFY_HEADER`) is **left in place,
untouched**. It is inert without infrastructure setting
`ORIGIN_VERIFY_SECRET` (which no longer happens), fully tested, and would
become useful again immediately if the SCP is ever loosened or this runs in
a different, unrestricted account.

## Consequences

### Positive

- Production is restored: `GET /` and every other route work again exactly
  as before #34's infrastructure changes.
- The failure mode is now understood and documented, instead of continuing
  to retry a mechanism that cannot work in this account.
- No infrastructure state is left half-migrated: OAC, the distribution
  origin, and the Lambda permissions are all back to one consistent,
  previously-proven-working shape.

### Negative

- `POST /analyze` (#34) is broken on real AWS again, with no fix landed yet.
  Recorded honestly in `AGENTS.md`.
- ADR-0017's shared-secret mechanism, while it works correctly in principle
  (verified on LocalStack, 100% mutation score), cannot be used in this AWS
  account as currently organized. That effort was not wasted — the code and
  its reasoning stand ready for whichever option below is chosen — but it is
  not currently deployed.

### Risks and mitigations

- *Risk*: nobody follows up, and `POST /analyze` stays permanently broken in
  production. *Mitigation*: recorded in `AGENTS.md` "Known gaps", not just
  buried in an ADR nobody re-reads.
- *Risk*: a future change re-introduces `AuthType NONE` without knowing about
  the SCP, causing this same outage again. *Mitigation*: the reasoning and
  the exact diagnostic commands that proved the SCP's existence are recorded
  here and in `infra/main.tf`'s comment on the Function URL resource.
- *Risk*: fixing this properly (Option 1 or 3) is deprioritized indefinitely
  because the site "works" again. *Mitigation*: none beyond this being
  written down; a real fix needs a deliberate follow-up.
