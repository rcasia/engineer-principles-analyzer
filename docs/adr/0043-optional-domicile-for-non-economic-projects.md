# ADR-0043: Optional domicile for non-economic personal projects

**Status**: Accepted
**Date**: 2026-09-26

## Context

The launch safeguard (shipped with the legal notices) requires the operator
name, domicile, privacy email and security email before any real AWS
deployment. The operator is an individual running a personal, free project
with no economic activity and no advertising, who does not want to publish a
home address and does not want to pay for a PO box or domiciliation.

LSSI art.10.1.a requires name, residence/domicile (or a permanent
establishment address in Spain) and email — but only for information-society
services constituting an economic activity. A strictly personal, free,
ad-free project is outside that scope. GDPR transparency (art.13.1.a),
however, still requires the controller's identity and contact details because
the service processes request data (IP/logs, 7 days) and submitted source,
including a transfer to the TypeSafe US subprocessor when enabled. That
data-protection review is separate work.

The repository precondition was a technical condition, not a legal mandate:
it forced a domicile even where the law relied upon does not demand one.

## Decision Drivers

- No home address published for a non-economic personal project.
- GDPR controller transparency still met with name plus monitored emails.
- Economic operators must still publish their domicile (LSSI art.10.1.a).
- Production must stay deployable for the personal case without fake data.

## Considered Options

### Option 1: Keep requiring the domicile for all prod deploys

- **Pros**: Simplest safeguard; no economic operator can launch without it.
- **Cons**: Forces an individual to choose between publishing a home address,
  paying for a domicile, or never deploying — for a case the cited rule does
  not cover.

### Option 2: Make the domicile optional; require name plus both emails

- **Pros**: Personal, non-economic projects deploy with name and contacts;
  GDPR identity/contact minimum holds; no fake addresses.
- **Cons**: An economic operator could omit the domicile and launch in breach
  of LSSI art.10.1.a. Mitigated by docs stating the duty explicitly
  (`infra/README.md`, variable description) and by the imprint rendering only
  what is configured — but not enforced by Terraform.

## Decision

Option 2. `legal_operator_address` is optional (null or blank means absent).
The Terraform precondition and Lambda environment require only the operator
name and both emails; a blank address is treated as absent everywhere and
never published. The imprint renders the domicile line only when configured.
Economic operators remain told to set it under LSSI art.10.1.a.

## Consequences

### Positive

- A personal, free, ad-free project deploys to production with name plus two
  monitored emails and no home address.
- No `example.test` or invented domiciles reach production.
- LocalStack and CI behaviour unchanged (still unconfigured without any vars).

### Negative

- Terraform no longer stops an economic operator who omits the domicile; that
  duty is documentary, not enforced.
- The imprint for personal projects shows no domicile, which a strict reader
  could question — the ADR records why.

### Risks and mitigations

- Risk: scope creep into economic activity (ads, sponsors, client
  acquisition) while the domicile stays unset. Mitigation: the triggering
  change must set the address in the same commit (per `docs/legal/README.md`
  product-mode rule).
- Risk: data-protection gaps confused with the domicile question.
  Mitigation: tracked separately; this ADR changes only the domicile
  requirement.
