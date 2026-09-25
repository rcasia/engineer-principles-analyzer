# Privacy Notice

The public version of this notice is served at `/privacy`. It must be reviewed
by a qualified person before commercial launch. Operator identity and contact
details are supplied through deployment configuration and published at
`/imprint`.

**Classification:** Public.

**Product mode:** Public informational pages and one-file hosted analysis;
source/results are not persisted by the application and the CLI has no
telemetry by default.

## Controller

The operator name, address, privacy contact and security contact are published
at `/imprint`. Use the privacy address there for privacy enquiries and rights
requests.

## What this covers

This notice covers the operator's own processing for the public site and the
hosted analysis service (`POST /analyze`). Source code may contain personal
data, credentials or proprietary material; users must remove material they are
not authorised to submit.

## Personal data processed

| Category | Source | Purpose | Lawful basis | Retention |
| --- | --- | --- | --- | --- |
| Source code and optional filename | Analysis request | Language detection and engineering analysis | Steps requested by the visitor and applicable legitimate interests | In memory for the request; not stored by the application |
| Server/request logs (may include IP) | Visiting or using the service | Security, availability and abuse prevention | Legitimate interests (Art 6(1)(f)) | Application log group: up to 7 days |
| Contact enquiries | User contacting the operator | Responding and handling rights requests | Legitimate interests / legal obligation | Only as long as needed for the enquiry or legal obligation |

No cookies or tracking technologies are in use; no advertising analytics
identify individuals; no source code or findings are included in product
metrics.

## Hosted analysis and providers

The application runs on AWS in `eu-west-1`. When language detection is
enabled, the submitted source and optional filename are sent to TypeSafe AI,
Inc. for that request. TypeSafe's DPA and published privacy policy state that
customer input is not used to train or fine-tune models. TypeSafe is a US
subprocessor; the transfer uses its DPA and applicable EU Standard Contractual
Clauses. See [subprocessors.md](subprocessors.md).

The application event store and aggregate metrics exclude source, prompts,
findings, repository names and user identifiers. Submitted responses are
marked `Cache-Control: no-store, private`.

## Measurement and telemetry

- **Engine evaluation:** precision, recall, error rates, calibration, evidence
  coverage and sample size per rule and language from controlled corpora.
- **Operational monitoring:** latency, rule-execution failures and contract
  validity through injected instrumentation.
- **Web product analytics:** first-party aggregates for request counts, failure
  rate, latency, abandonment and language/rule distributions. No source,
  prompts, findings, repository names, identifiers or cookies.
- **CLI:** no telemetry by default. Local usage stays local unless a future
  opt-in is introduced and separately documented.
- **Public exemplars:** opt-in educational entries only; private/customer code
  and individual developer rankings are not published.

## Data subject rights

Depending on applicable law, you may request access, correction, deletion,
restriction, portability or object to processing. You may also complain to the
Spanish Data Protection Agency (AEPD) or another competent supervisory
authority. Email the privacy address published at `/imprint`. Requests are
verified where necessary and handled within the period required by applicable
law.

## International transfers

Infrastructure defaults to AWS `eu-west-1` (Ireland). TypeSafe AI, Inc. is in
the United States and is covered by its DPA and applicable EU SCCs. Hosting
region is not offered to users as a residency guarantee.

## AI-assisted processing

Language detection is AI-assisted when TypeSafe Jev is configured. The
application discloses this at `/ai-transparency`; SOLID findings also expose
their method, confidence, evidence and limitations.

## Changes

This notice is updated in the same change as any product feature that alters
what personal data is processed, why it is processed or who receives it.
