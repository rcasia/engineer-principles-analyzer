# ADR-0017: Protect the CloudFront origin with a shared secret header, not OAC

**Status**: Superseded by [ADR-0018](0018-revert-to-oac-scp-blocks-public-function-urls.md). The
mechanism here is sound and fully tested, but this AWS account's Organization
blocks unauthenticated Lambda Function URLs account-wide, which was
discovered only by deploying this and is outside anything this repository
controls. Kept for the reasoning and the inert, ready-to-use code it left
behind.
**Date**: 2026-09-19

## Context

ADR-0009 put CloudFront in front of the Lambda Function URL and locked the
origin down with **origin access control** (OAC): the Function URL required
`AWS_IAM`, and CloudFront signed every origin request with SigV4 so nobody
could hit the public function directly and bypass the cache.

That worked while every route was a `GET`. [#34](../../AGENTS.md) added a
`POST /analyze` form (analyze a single source file, ADR-0015). In production
that form returned:

```
403 {"message":"The request signature we calculated does not match the
signature you provided. Check your AWS Secret Access Key and signing method."}
```

The cause is a documented OAC limitation. AWS states plainly:

> If you use PUT or POST methods with your Lambda function URL, your user
> must provide a signed payload to CloudFront. Lambda doesn't support
> unsigned payloads.

OAC signs the SigV4 *headers* but does **not** compute the payload hash
(`x-amz-content-sha256`) for a request body. Lambda then rejects the POST
because the signature does not cover the body. CloudFront cannot add that
header itself — CloudFront Functions have no access to the request body, and
only client-side code or a Lambda@Edge origin-request function can compute it.
We ship **no client-side JavaScript** (ADR-0004), so the client cannot do it.

So OAC and an unsigned same-origin `POST` are mutually exclusive here. The
first fix (b15393c) only widened `AllowedMethods` to admit POST; that cleared
CloudFront's *own* method 403 but exposed this deeper SigV4 one, and the
`promote to production` deploy check caught it before users did.

## Decision Drivers

- **`POST /analyze` must work through the CDN**, with a source file too large
  for a query string, so it cannot become a `GET`.
- **No client-side JavaScript** (ADR-0004), so the payload hash cannot be
  computed in the browser.
- **The origin must stay private** — a directly reachable Function URL lets
  anyone bypass the cache and burn the Lambda free tier (the whole point of
  ADR-0009's lock-down).
- **Keep the LocalStack gate meaningful.** A fix that can only ever run on
  real AWS widens the already-accepted CDN blind spot.

## Considered Options

### Option 1: Lambda@Edge origin-request function that signs the payload

- **Pros**: Keeps `AWS_IAM` + OAC; the origin stays IAM-protected with real
  SigV4. Transparent to clients.
- **Cons**: Lambda@Edge has no free tier and bills per request (ADR-0009
  rejected it once already on cost). Runs `us-east-1`-only, adds deploy
  latency and a second function to operate. Cannot be exercised on LocalStack
  Community, so it deepens the blind spot rather than shrinking it.

### Option 2: Make `/analyze` a `GET` with the source in the query string

- **Pros**: OAC signs `GET` fine; no new mechanism.
- **Cons**: CloudFront caps the URL at ~8 KB; a "single source file" routinely
  exceeds that. Puts source code in URLs, access logs and history. Defeats the
  feature.

### Option 3: `AuthType NONE` + a shared secret header only CloudFront knows

- **Pros**: Works identically for GET and POST — no payload signing involved.
  No client JavaScript. Free. The same public Function URL already runs on
  LocalStack, so behaviour converges and the deploy check can assert the lock
  on real AWS. The secret is a Terraform-managed `random_password`, injected
  as a CloudFront origin `custom_header` and checked by the adapter.
- **Cons**: Weaker than SigV4: a leaked secret grants direct origin access
  until rotated (rotation = taint the resource and re-apply). The secret lives
  in Terraform state (already sensitive and access-controlled). Enforcement is
  now application logic, not IAM, so it must be tested — not free correctness.

### Option 4: Leave the origin fully public (drop the lock entirely)

- **Pros**: Simplest.
- **Cons**: Reinstates the "public Function URL, cache bypassable, free tier
  burnable" risk ADR-0009 explicitly retired. Rejected.

## Decision

Adopt **Option 3**. On real AWS the Function URL is `AuthType NONE`, and the
origin is kept private by a shared secret:

- A Terraform `random_password` is set as a CloudFront origin `custom_header`,
  `x-origin-verify`, sent on every origin request, and passed to the Lambda as
  the `ORIGIN_VERIFY_SECRET` environment variable.
- The web adapter refuses — `403 Forbidden`, `no-store` — any request whose
  `x-origin-verify` header does not match the configured secret, before
  routing. When the variable is unset (LocalStack, local dev) the check is
  skipped and the origin is deliberately open, exactly as before.
- `AllowedMethods` keeps the full GET/HEAD/OPTIONS/PUT/POST/PATCH/DELETE set
  (b15393c) because CloudFront offers no GET/HEAD/OPTIONS/POST subset.
- The OAC resource and the two `cloudfront.amazonaws.com` invoke permissions
  are removed; CloudFront now reaches the origin as an ordinary anonymous
  HTTPS client that happens to carry the secret header.

This supersedes only the **origin-access-control mechanism** of ADR-0009.
Everything else there — CloudFront itself, `PriceClass_All`, the custom cache
policy, `AllViewerExceptHost`, origin-driven `Cache-Control` — stands. The
`Host` header still must not be forwarded, now because the Function URL
validates `Host` against its own domain rather than because of a signature.

## Consequences

### Positive

- `POST /analyze` works through the CDN with no client JavaScript.
- The origin is still private: a direct hit lacks the secret and gets 403,
  asserted on every real deploy by `scripts/check-deployed.ts`.
- Local and production converge on `AuthType NONE`; the divergence ADR-0009
  introduced (auth mode) is smaller, though the secret itself is prod-only.
- Cheaper and simpler than Lambda@Edge; nothing new to run.

### Negative

- Weaker than SigV4. The secret is a bearer token: whoever has it can reach
  the origin directly until it is rotated.
- Origin protection is now application code, not IAM. A bug in the check is a
  hole, which is why `server.test.ts` covers missing, wrong, matching and
  absent-secret cases, and the deploy check asserts the 403.
- The secret sits in Terraform state. State is already treated as sensitive,
  but this adds a credential to it.

### Risks and mitigations

- *Risk*: the secret leaks (logs, state exfiltration) and the origin is open.
  *Mitigation*: rotate by tainting `random_password.origin_secret` and
  re-applying; both the header and the env var update together. The value is
  never logged and never returned by an output.
- *Risk*: the check is deployed misconfigured (env var unset on real AWS) and
  the origin is silently public. *Mitigation*: `check-deployed.ts` fetches the
  origin URL directly on every deploy and fails unless it returns 403.
- *Risk*: the POST path regresses in a way LocalStack cannot see.
  *Mitigation*: `check-deployed.ts` POSTs to `/analyze` through the CDN on
  every real deploy and requires 200, so a broken secret path or method
  restriction fails the deploy.
