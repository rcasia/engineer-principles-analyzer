# Security and Vulnerability Disclosure

The public version of this notice is served at `/security`. It must be
reviewed by qualified counsel before commercial launch. The security contact
is published at `/imprint`.

## Vulnerability disclosure

Report security issues privately to the security address at `/imprint`.
Include enough detail to reproduce the issue, but do not include live
credentials or unrelated personal data. Please do not publicly disclose an
issue before the operator has had a reasonable opportunity to investigate.

## Current controls

- HTTPS is enforced at the CDN and the origin uses TLS.
- Security headers are emitted by the application as well as the CDN.
- Submitted analysis responses are `private` and `no-store`; static pages and
  immutable bundles use separate cache policies.
- The production function is reachable through the CloudFront origin path, not
  a public application endpoint.
- Source code and complete findings are excluded from event history and
  aggregate metrics.
- Application log retention is capped at 7 days.
- Dependencies are audited in the delivery pipeline.
- The analyzer rejects requests above its configured body-size limit.

These controls reduce risk but cannot guarantee that an electronic service is
invulnerable. Users must remove secrets before submission; the service does
not promise to detect or redact every secret.

## Incident response

The operator will assess security incidents, contain them, notify affected
parties and supervisory authorities where required, and document remediation.
