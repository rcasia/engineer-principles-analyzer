# ADR-0041: Serve the site from an optional custom domain

**Status**: Accepted
**Date**: 2026-09-23

## Context

The site answers on the distribution's default `xxx.cloudfront.net` domain.
That is fine for a staging URL but not a product address: it cannot be
branded, it changes if the distribution is ever replaced, and nobody will
remember it. The target is an apex domain such as `principled.sh`, served in
addition to the default domain, with the default domain 301-redirecting to
it.

## Decision Drivers

- **Off by default.** Every gate (LocalStack apply, `terraform validate`,
  deploy with no extra configuration) must behave exactly as before until the
  domain is owned and switched on.
- **Everything as code**, like the rest of the stack: cert, validation,
  aliases and DNS records from the same `apply`, verified by
  `check-deployed.ts`.
- ** apex must work.** A plain CNAME cannot sit at the zone apex, which rules
  out any DNS provider without alias/flattening support for the bare domain.
- **$0 at current traffic**, the standing budget constraint (ADR-0009).

## Considered Options

### Option 1: Route53 + ACM + CloudFront aliases (chosen)

- **Pros**: Route53 alias records solve the apex problem natively, and alias
  queries to CloudFront are free. ACM certificates are free. DNS validation
  records are Terraform resources, so issuance is fully automatic. Same
  account, same IAM model, same state as everything else.
- **Cons**: The hosted zone is $0.50/month — the first recurring DNS cost this
  stack has. The `.sh` registration itself (~$76/year) dwarfs that, so DNS is
  not the cost driver, but it is no longer $0-absolute.

### Option 2: External DNS with CNAME flattening (e.g. Cloudflare)

- **Pros**: Free DNS; possibly cheaper `.sh` registration than Route53.
- **Cons**: ACM DNS validation becomes a manual copy-paste step outside the
  apply, the deploy role needs no new permissions but the human does the
  work on every re-issuance, and DNS state lives outside Terraform — a second
  source of truth for the thing most likely to break the site.

### Redirecting the default domain: CloudFront Functions (chosen)

- **Pros**: Viewer-request trigger runs before the cache, so the
  cloudfront.net URL never serves content. $0.10/M requests inside a 2M/month
  free tier — $0 here. No new region, no versioning dance.
- **Cons**: A second edge compute mechanism next to the Lambda@Edge signer
  (ADR-0019) to reason about. A POST to the old domain 301s and the client
  resubmits as GET, dropping the body — acceptable because the canonical
  domain is advertised going forward, but worth stating.

### Redirecting the default domain: app-level Host check (rejected)

- **Pros**: No new infrastructure at all — a few lines in the web adapter.
- **Cons**: Cannot work with the current origin request policy:
  `Managed-AllViewerExceptHostHeader` deliberately withholds the viewer Host
  from the origin (ADR-0009), so the app cannot tell which domain was
  requested without extra header plumbing that would itself weaken the OAC
  signature story. Rejected on technical grounds.

## Decision

Serve an optional apex domain via **`var.custom_domain`** (default `null`):

- `local.custom_domain_enabled` is true only on real AWS with the variable
  set; LocalStack ignores it entirely (no CloudFront there).
- ACM certificate in **us-east-1** (CloudFront only accepts certs from there),
  DNS-validated with Terraform-managed records; the distribution references
  the *validation* resource so it waits for issuance.
- `aliases` plus `A`/`AAAA` Route53 alias records at the apex.
- A published CloudFront Function (`cloudfront/canonical-host.js`) on
  viewer-request 301s any `*.cloudfront.net` host to the custom domain,
  preserving path and query string.
- Enabling in production is one repository variable: `CUSTOM_DOMAIN`, read by
  the deploy job. The zone must already exist (registering through Route53
  creates it); Terraform looks it up and fails fast on a typo.
- `check-deployed.ts` runs the full page suite against the custom domain when
  set, and asserts the default domain 301s to it.

## Consequences

### Positive

- A brandable, stable product URL with zero behaviour change until switched on.
- Issuance, aliases, DNS and redirect land in one apply and are verified on
  every deploy.
- Still $0 at current traffic: cert free, alias queries free, function inside
  the free tier. Only the $0.50/month zone is new.

### Negative

- **Distribution updates take several minutes to propagate**, so the deploy
  that switches the domain on (and any later cert/alias change) is slow and
  the redirect is not instant. Acceptable for a one-time switch.
- **The deploy role widens**: ACM plus Route53 record rights (scoped as far
  as CloudFront already is — distribution/function ARNs contain generated
  IDs, so prefix-scoping is impossible; see the bootstrap README), and
  CloudFront Function lifecycle rights join the already-broad Cdn statement.
- **Two edge compute mechanisms** (Lambda@Edge signer + CloudFront Function)
  with different runtimes, regions and trigger points. Each is documented at
  its resource; the split is by capability (signing needs request bodies,
  redirect needs viewer-request), not accident.
- A POST to the *old* domain loses its body on the 301. The old domain is
  undocumented going forward, so this only bites stale bookmarks of
  `/analyze` submitted directly — and GETs redirect losslessly.

### Risks and mitigations

- *Risk*: The switch-on deploy serves the old certificate or no alias while
  CloudFront propagates, failing `check-deployed.ts`.
  *Mitigation*: accepted — the check fails the deploy rather than shipping
  silently, and re-running it after propagation goes green.
- *Risk*: ACM validation records linger if the domain is later removed,
  leaving orphan DNS.
  *Mitigation*: all records are Terraform-managed, so disabling the variable
  destroys them with the cert.
- *Risk*: Someone enables the variable against a zone in another account.
  *Mitigation*: the `aws_route53_zone` data lookup is same-account only and
  fails the plan with no zone found.
