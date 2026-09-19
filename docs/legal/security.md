# Security and Vulnerability Disclosure (DRAFT)

> **Status:** Draft skeleton. The vulnerability-disclosure contact should be
> made real early, even pre-launch; the rest is completed as controls ship.

**Classification:** Public.

## Vulnerability disclosure

If you believe you have found a security vulnerability in Principled, please
report it privately to _to be completed_ (security contact). Please do not
open a public issue for security reports. We aim to acknowledge within
_to be completed_ and will keep you informed of remediation.

## Security controls (owned by the features that add them)

These are engineering controls; each is delivered by the relevant feature, and
this document records the resulting posture:

- No-store analysis path (`Cache-Control: no-store, private`) and a separate
  CloudFront behavior for user/code-specific responses (#17).
- Request/body size limits, rate limiting and abuse controls (#17).
- Secret scanning/redaction before code reaches any external model provider.
- Sensitive-data logging tests: source code, prompts, results, credentials,
  cookies, authorization headers and request bodies are never logged.
- Encryption strategy for any persisted customer data.
- Tenant isolation before multi-user storage.
- Authentication/authorization model.
- Security headers.
- Dependency/SBOM and release-security baseline (see ADR-0011, `bun audit`).

## Incident response and breach notification

Procedure to be documented: detection, triage, containment, notification
timelines (GDPR Article 33/34 where applicable), and post-incident review.
