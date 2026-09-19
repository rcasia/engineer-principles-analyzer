# ADR-0009: Serve globally from CloudFront, with the origin locked to it

**Status**: Accepted (supersedes the "no CloudFront" decision in ADR-0005). The
origin-access-control mechanism is superseded by [ADR-0017](0017-shared-secret-origin-instead-of-oac.md);
CloudFront and the rest of this decision stand.
**Date**: 2026-09-19

## Context

ADR-0005 chose a bare Lambda Function URL and stated: *"There is deliberately
no API Gateway and no CloudFront. A Function URL is free, whereas API Gateway
bills per request."*

That lumped CloudFront in with API Gateway and rejected both on cost. **The
cost premise was wrong.** CloudFront's free tier is 1 TB of egress and 10
million HTTPS requests per month, permanently — not a 12-month trial — and
data transfer from an AWS origin into CloudFront is $0.00/GB.

The requirement has also become explicit: the app should be **global and cost
effective**. A single region cannot be. Measured round trip from western
Europe:

| Region                  | RTT    |
| ----------------------- | ------ |
| `eu-south-2` (Spain)    | 23 ms  |
| `eu-west-1` (Ireland)   | 49 ms  |
| `us-east-1`             | 103 ms |
| `us-west-2`             | 184 ms |
| `sa-east-1`             | 224 ms |

Choosing a "central" region makes everyone equally badly served. And because
the UI ships no client-side JavaScript (ADR-0004), every navigation is a full
round trip, so latency compounds rather than amortises.

## Decision Drivers

- **Global reach**, without multi-region infrastructure to operate.
- **Cost effective**, meaning $0 at present traffic and a bounded worst case.
- **Cold starts are the bigger latency cost.** A Node Lambda cold start is
  roughly 150-400 ms, far more than any 26 ms difference between regions.
  Region shopping optimises the smaller term.

## Considered Options

### Option 1: CloudFront in front of the existing Function URL

- **Pros**: ~600 edge locations terminate TLS near the user. Cached responses
  never reach the origin, so most users skip the cold start entirely and the
  Lambda free tier is barely consumed. Free within the permanent tier. Keeps
  every existing resource. Adds AWS Shield Standard at no cost.
- **Cons**: LocalStack Community cannot emulate CloudFront, so the CDN falls
  outside the credential-free `apply` gate.

### Option 2: Multi-region Lambda with Route 53 latency routing

- **Pros**: Low origin latency everywhere, no CDN semantics to reason about.
- **Cons**: Hosted zone and health check charges, N regions of state and
  deployment to operate, and it still does not cache. Strictly worse on both
  drivers.

### Option 3: Lambda@Edge or CloudFront Functions

- **Pros**: Renders at the edge; no origin region at all.
- **Cons**: Lambda@Edge has no free tier and costs more per request.
  CloudFront Functions cap source at 10 KB with a restricted JS environment
  and no standard `Request`/`Response`, so the current handler would not run.

### Option 4: Move to Cloudflare Workers

- **Pros**: Globally distributed by default; very generous free tier.
- **Cons**: Discards the working AWS stack, and reintroduces exactly what
  ADR-0005 rejected — verification requiring a real account and an API token
  in CI. The credential-free gate is worth more than the marginal gain.

### Protecting the origin

With a CDN, a public Function URL is a hole: anyone can bypass the cache,
hit Lambda directly and consume the free tier. **Origin access control**
(GA April 2024, no additional charge) makes CloudFront sign origin requests
with SigV4 and lets the Function URL require `AWS_IAM`.

## Decision

Put **CloudFront in front of the Lambda Function URL**, with
`PriceClass_All` for genuine global reach, and lock the origin down with
**origin access control**.

- The Function URL is `AWS_IAM` on real AWS and `NONE` on LocalStack.
- Both `lambda:InvokeFunctionUrl` **and** `lambda:InvokeFunction` are granted
  to `cloudfront.amazonaws.com`, scoped by `SourceArn` to this distribution.
  Function URLs created after October 2025 require both; granting only the
  first returns `403 AccessDeniedException`.
- Caching is driven by the **origin's** `Cache-Control`, so caching is decided
  in the application: `max-age=60, stale-while-revalidate=600` for the page
  and `max-age=300` for 404s. Without those headers the CDN revalidates on
  every request and buys nothing.
- This uses a **custom** cache policy, not the managed
  `UseOriginCacheControlHeaders` one, for a reason worth stating plainly: that
  managed policy independently whitelists `Host` in its own header
  configuration, merged with whatever the origin request policy forwards.
  That silently reintroduced the distribution's own `Host` on every origin
  request, which broke OAC's signature (see the first deploy, below). The
  custom policy carries the same TTL bounds with no header whitelist of its
  own, so the origin request policy is the only place that decides what
  reaches the origin.
- The `Managed-AllViewerExceptHostHeader` origin request policy is required:
  forwarding the viewer `Host` would break the SigV4 signature.
- `Managed-SecurityHeadersPolicy` adds HSTS and friends at no cost.

**The origin region stays `eu-west-1`.** Behind a CDN the origin is only
reached on a cache miss, so it is no longer a user-facing latency decision.
Ireland is the cheapest EU pricing tier, the most mature EU region, and keeps
data in the EU — which matters if the domain ever analyzes engineer activity,
since that is personal data.

## Consequences

### Positive

- Global users are served from a nearby edge instead of one region.
- Cache hits never invoke Lambda, so cold starts disappear for most requests
  and the Lambda free tier stops being the binding constraint.
- The Function URL is no longer publicly reachable, which retires the
  "public Function URL with no budget alarm" risk recorded in ADR-0005: the
  cache cannot be bypassed to run up cost.
- Still $0 at current traffic.

### Negative

- **The CDN is not covered by the LocalStack gate.** LocalStack Community has
  no CloudFront, so the distribution, the OAC and the IAM auth mode are
  guarded by `count` and exist only on real AWS. CI covers them with
  `terraform validate` only.
- **Local and production now differ** in Function URL auth mode. ADR-0005's
  "the same configuration targets both" is weaker than it was, and this is
  the first real divergence.
- CloudFront distributions take several minutes to create and update, so
  deploys are slower.
- Cached content means a deploy is not instantly visible. Acceptable at
  `max-age=60`; anything longer would need invalidations.
- The deploy role needs CloudFront permissions that cannot be scoped by name,
  because distribution ARNs contain a generated ID. It is now the least
  scoped statement in the bootstrap policy.

### What actually happened on the first deploy

The first real `terraform apply` succeeded completely — nine resources
created, plan matched exactly. `check-deployed.ts` then failed: every request
returned `403 {"Message":null}`, with **zero Lambda invocations** logged in
CloudWatch. That last fact mattered most: it proved the rejection happened at
the IAM/authorizer layer, before the function ever ran, which ruled out an
application bug immediately.

What it was not, ruled out in order: IAM trust-policy propagation (a
different, real issue fixed the same day — see ADR-0007's OIDC subject
format note — but re-testing after 15+ minutes here changed nothing, and
CloudFront reported `Deployed`); a missing `lambda:InvokeFunction` permission
(both grants were present and correctly scoped, confirmed via
`aws lambda get-policy`); the origin request policy forwarding too much
(removing it entirely changed nothing).

What it was: the managed cache policy's own `Host` whitelist, described
above. Confirmed by reading that policy's actual definition via
`aws cloudfront get-cache-policy`, not by inspecting our own config, which
looked correct in isolation. Fixed and verified directly against the live
distribution — 200, a genuine `x-cache: Hit from cloudfront` on a second
request, the origin still 403 to direct access — before this was written up.

The lesson worth keeping: two independent CloudFront settings (cache policy,
origin request policy) both contribute to the same outgoing header set, and
a managed policy's contents are not implied by its name. `UseOriginCacheControlHeaders`
says nothing about `Host` in its name or its stated purpose.

### Risks and mitigations

- *Risk*: OAC is misconfigured and the origin stays publicly reachable,
  silently removing the protection.
  *Mitigation*: `scripts/check-deployed.ts` fetches the origin URL directly
  on every deploy and **fails** unless it returns 403. It also asserts the
  page is cacheable and reports the edge cache state.
- *Risk*: A CloudFront regression reaches production because the PR gate
  cannot apply it.
  *Mitigation*: accepted. The deploy job runs `check-deployed.ts` against the
  real distribution, so a broken CDN fails the deploy rather than a PR.
  Buying LocalStack Pro would close this gap if it ever justifies the cost.
- *Risk*: Traffic exceeds the free tier.
  *Mitigation*: 10M requests/month at a ~3 KB page is far beyond current
  traffic, and requests, not bandwidth, are the binding limit. A budget alarm
  remains a tracked gap.
