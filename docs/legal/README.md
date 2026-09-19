# Legal documentation

Product legal and compliance documents, kept separate from engineering ADRs
(`docs/adr/`) and product design (`docs/design/`). This directory is the home
of the privacy, security and AI-transparency baseline tracked in
[issue #28](https://github.com/anomalyco/opencode/issues/28) (a cross-cutting
enabler, not a user story) and scaffolded by
[issue #29](https://github.com/anomalyco/opencode/issues/29).

> **These documents are DRAFTs and are not in force.** Nothing here is a legal
> notice, a contract, or legal advice. Principled has no hosted service that
> accepts user code today (see "Current product mode"), so no document below
> is published or binding. Each must be reviewed by a qualified person before
> commercial launch.

## The one rule that governs this directory

**No document may promise a stronger privacy, residency, retention or
model-training guarantee than the actual architecture and subprocessors
support.** A guarantee is added here only once the code, infrastructure and
subprocessor list already make it true. When a feature needs a legal
guarantee, the feature ships the guarantee *and* the document change together
— it is not pre-written here in the hope the feature will one day match it.

## Territorial scope and market-targeting model

Three separate questions decide which obligations apply. Conflating them is
the most common way to either overstate compliance or invent obligations that
do not exist.

1. **Where the service is hosted.** Today the infrastructure defaults to AWS
   `eu-west-1` (Ireland) — see `infra/variables.tf`. Hosting location is an
   infrastructure and international-transfer consideration. It does **not** by
   itself determine the complete set of laws governing the product, and it is
   not a data-residency guarantee to users unless a document explicitly makes
   one.
2. **Where the operator is established.** Principled's operator is established
   in the EU/Spain. Under GDPR Article 3(1), an EU establishment is an
   independent basis for the GDPR (and Spain's LOPDGDD) applying to processing
   carried out in the context of that establishment — regardless of where the
   servers sit or where users are. This applies to the operator's *own*
   processing (e.g. server/request logs, contact enquiries) even before any
   user code is processed.
3. **Which markets Principled deliberately targets.** The public
   informational site is intended to be generally available to developers who
   discover it. Mere global accessibility is **not** market targeting (GDPR
   Article 3(2), Recital 23, EDPB Guidelines 3/2018). Do not infer deliberate
   UK/US/Brazil/Australia targeting from IP location or incidental visits, and
   do not create country-specific public pages or assume a jurisdiction's
   consumer/privacy regime applies solely because a visitor can load a page.
   Targeting is a deliberate product decision (country-specific pricing,
   geo-targeted campaigns, local contact details, references to customers in a
   jurisdiction, market-specific ordering).

The baseline is therefore **EU/Spain-first for the operator's own processing
and product obligations**, with other jurisdictions assessed only when
Principled deliberately enters a market or when another independent
territorial rule (establishment, the processing activity itself, or a
contract) brings the activity within scope.

## Hosted analysis is a separate processing activity

The static public pages and the hosted analysis endpoint are **not** the same
for legal purposes. A future `POST /api/analyze` receives and processes user
source code — potentially containing personal data, secrets and proprietary
material — and so needs its **own** territorial, privacy, retention,
subprocessor and data-flow assessment, distinct from the informational site.
No such endpoint exists yet (`packages/web/src/server.ts` serves only `/`,
`/design`, and a 404). The assessment is owned by the feature that introduces
it (#17); this directory documents the guarantees that feature makes true.

## Current product mode

Legal obligations depend on what the product actually does. Today:

- There is **no hosted service that accepts user source code**. The web app
  serves public informational pages only; deployment has been exercised on
  LocalStack, never against real users (see `AGENTS.md` "Known gaps").
- The **CLI is not published** and emits **no telemetry**.
- **No customer content is persisted**, because there is no hosted analysis.
- GDPR/LOPDGDD **apply to the operator's own processing** by virtue of the
  EU/Spanish establishment (question 2 above), even though **no user-content
  processing and no controller/processor-of-customer-data relationship exists
  yet**. The AI Act provider/deployer roles are **not yet triggered** because
  no AI system is placed on the market or put into service.

When the product changes mode — accepts remote code, persists projects,
integrates with Git providers, publishes the CLI, or deliberately targets a
market — the triggering change updates the affected documents in the same
commit.

## Document register

Classification tells a reader whether a document is meant for the public, for
customers under contract, or for internal use.

| Document | Classification | Status | Becomes relevant when |
| --- | --- | --- | --- |
| [privacy-policy.md](privacy-policy.md) | Public | Draft skeleton | The operator processes any personal data (already partially true for own processing) |
| [terms-of-service.md](terms-of-service.md) | Public | Draft skeleton | The hosted service is offered to users |
| [acceptable-use-policy.md](acceptable-use-policy.md) | Public | Draft skeleton | The hosted service accepts user input |
| [ai-transparency.md](ai-transparency.md) | Public | Draft skeleton | AI-assisted analysis is exposed to users |
| [data-processing-agreement.md](data-processing-agreement.md) | Customer-contractual | Draft skeleton | A customer processes personal data through Principled |
| [subprocessors.md](subprocessors.md) | Public | Draft skeleton | Any third party processes customer data |
| [data-retention.md](data-retention.md) | Public + contractual | Draft skeleton | Any customer data is persisted |
| [security.md](security.md) | Public | Draft skeleton | Now — vulnerability disclosure should exist early |
| [regional-notices/](regional-notices/) | Public | Placeholder | A jurisdiction is deliberately targeted or independently in scope |

Sensitive legal strategy, negotiation notes and non-public assessments do
**not** belong in this public repository. Keep them in the private strategy
repository.

## Compliance applicability

The acceptance criteria for #28 require applicability to be *documented rather
than assumed*, recording the concrete territorial trigger, product activity
and rationale for each regime. The list below is not a claim that every regime
applies to every public page.

### Core baseline — always assessed (operator established in EU/Spain)

| Regime | Current applicability | Trigger |
| --- | --- | --- |
| EU GDPR | Applies to the operator's own processing | EU establishment (Art 3(1)) |
| Spain LOPDGDD | Applies to the operator's own processing | Operator established in Spain |
| EU / Spanish ePrivacy | Assessed; no cookies/tracking in use yet | Cookies/tracking on the public site |
| EU AI Act | Not yet triggered — no AI system placed on the market | AI-assisted analysis offered to users |
| EU Accessibility Act / WCAG | Design baseline tracked in `docs/design/` | Commercial service offered in the EU |
| International data transfers | Assessed; hosting in `eu-west-1`, no non-EU subprocessor yet | A subprocessor processes data outside the EEA |

### Conditional — assessed on a recorded trigger

Accessibility of the public site alone is not a trigger.

| Regime | Trigger that would bring it into scope |
| --- | --- |
| UK GDPR / PECR | Deliberate targeting of the UK market, or an independent territorial trigger |
| California CCPA/CPRA and other US state laws | The statute's own scope/threshold is met |
| Brazil LGPD | Its territorial/scope criteria are met |
| Australia Privacy Act / APPs | Its scope criteria are met |
| NIS2 | The final service model falls within scope |
| Cyber Resilience Act | The actual software/product model falls within scope |

## How this connects to the architecture

- Ephemeral-by-default analysis and the no-store response path are engineering
  controls owned by the features that introduce them (#17 web workflow, #8
  result contract), not by this directory. This directory documents the
  guarantees those controls make true.
- Event-sourcing privacy implications are owned by
  [ADR-0012](../adr/0012-event-sourcing-and-cqrs.md) and #33; retention rules
  for sensitive artifacts live in [data-retention.md](data-retention.md).
- Metrics and telemetry policy is split across #30/#31/#32; the
  privacy-affecting parts are summarised in
  [privacy-policy.md](privacy-policy.md).

## References

- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679
- GDPR Article 3 (territorial scope) and Recital 23
- EDPB Guidelines 3/2018 on the territorial scope of the GDPR
- Spain LOPDGDD (Ley Orgánica 3/2018): https://www.boe.es/eli/es/lo/2018/12/05/3
- EU AI Act: https://eur-lex.europa.eu/eli/reg/2024/1689
- EU AI Act Navigator: https://artificialintelligenceact.eu/
- EU Accessibility Act: https://eur-lex.europa.eu/eli/dir/2019/882
- NIS2: https://eur-lex.europa.eu/eli/dir/2022/2555
- Cyber Resilience Act: https://eur-lex.europa.eu/eli/reg/2024/2847
- California CCPA/CPRA: https://privacy.ca.gov/california-privacy-rights/
