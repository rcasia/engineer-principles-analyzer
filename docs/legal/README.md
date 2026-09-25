# Legal documentation

Product legal and compliance documents, kept separate from engineering ADRs
(`docs/adr/`) and product design (`docs/design/`). This directory is the home
of the privacy, security and AI-transparency baseline tracked in
[issue #28](https://github.com/anomalyco/opencode/issues/28) (a cross-cutting
enabler, not a user story) and scaffolded by
[issue #29](https://github.com/anomalyco/opencode/issues/29).

The public versions of the privacy, terms, acceptable-use, security, AI
transparency, subprocessors and accessibility notices are served by the web
package at `/privacy`, `/terms`, `/acceptable-use`, `/security`,
`/ai-transparency`, `/subprocessors` and `/accessibility`. The operator identity
and contact details are deployment configuration and are required by Terraform
for real AWS deployments. These documents still require qualified legal review;
the repository cannot determine the operator's legal identity or replace that
review.

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
for legal purposes. The live `POST /analyze` and JSON content-negotiated
equivalent receive and process one source file at a time. Source can contain
personal data, secrets and proprietary material. The service therefore has its
own privacy, retention, subprocessor and data-flow rules, distinct from the
informational pages. The app does not persist source or results, but language
detection sends the source and optional filename to TypeSafe when that
integration is enabled.

## Current product mode

Legal obligations depend on what the product actually does. Today:

- **The hosted service accepts one source file per analysis request**. It uses
  `Cache-Control: no-store, private` for submitted requests and does not persist
  source or findings in the application event store.
- The **CLI is not published** and emits **no telemetry**.
- **No customer content is persisted by the application**. AWS operational logs
  are retained for up to 7 days, and aggregate metrics are in-memory per Lambda
  environment.
- GDPR/LOPDGDD **apply to the operator's own processing** and the hosted
  analysis data flow by virtue of the EU/Spanish establishment (question 2
  above). The operator must complete its controller/processor assessment and
  customer DPA before offering enterprise processing.

When the product changes mode — persists projects, integrates with Git
providers, publishes the CLI, adds accounts or payments, or deliberately
targets a market — the triggering change updates the affected documents in the
same commit.

## Document register

Classification tells a reader whether a document is meant for the public, for
customers under contract, or for internal use.

| Document | Classification | Status | Becomes relevant when |
| --- | --- | --- | --- |
| [privacy-policy.md](privacy-policy.md) | Public | Served at `/privacy`; legal review required | The operator processes request data and submitted source |
| [terms-of-service.md](terms-of-service.md) | Public | Served at `/terms`; legal review required | The hosted service is offered to users |
| [acceptable-use-policy.md](acceptable-use-policy.md) | Public | Served at `/acceptable-use`; legal review required | The hosted service accepts user input |
| [ai-transparency.md](ai-transparency.md) | Public | Served at `/ai-transparency`; legal review required | AI-assisted language detection is exposed to users |
| [data-processing-agreement.md](data-processing-agreement.md) | Customer-contractual | Draft skeleton | A customer processes personal data through Principled |
| [subprocessors.md](subprocessors.md) | Public | Served at `/subprocessors`; legal review required | AWS and TypeSafe process request data |
| [data-retention.md](data-retention.md) | Public + contractual | Engineering source of truth; legal review required | Customer-specific data is persisted |
| [security.md](security.md) | Public | Served at `/security`; legal review required | Vulnerability disclosure exists before launch |
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
| EU AI Act | AI-assisted language detection is disclosed; classification and obligations require legal review | AI-assisted analysis offered to users |
| EU Accessibility Act / WCAG | Design baseline tracked in `docs/design/` | Commercial service offered in the EU |
| International data transfers | AWS hosting is in `eu-west-1`; TypeSafe is a US subprocessor using its DPA and SCCs | A subprocessor processes data outside the EEA |

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
  [privacy-policy.md](privacy-policy.md). The executable side lives in core:
  `compliance/domain/sensitive-data.ts` (no telemetry by default,
  forbidden-key guard), `metrics/domain/web-metrics.ts` (aggregates only,
  served at `GET /metrics`), `evaluation/domain/` (versioned snapshots, no
  opaque score) and `exemplars/domain/` (opt-in publication with
  correction/removal).

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
