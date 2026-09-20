# Privacy Policy (DRAFT — not in force)

> **Status:** Draft skeleton. Not published, not binding. Must be reviewed by a
> qualified person before commercial launch. See
> [README](README.md) for the product mode this assumes.

**Classification:** Public.
**Assumed product mode:** Public informational site only; no hosted analysis,
no persistence, CLI not published (no telemetry). GDPR/LOPDGDD already apply to
the operator's *own* processing via the EU/Spanish establishment.

## Controller

- Operator: _to be completed_ (established in EU/Spain).
- Contact for privacy enquiries: _to be completed_.

## What this covers

This notice covers the operator's own processing for the **public site**. The
hosted analysis service (`POST /api/analyze`) is a separate processing
activity with its own assessment; it is not offered yet and is not described
here (see README, "Hosted analysis is a separate processing activity").

## Personal data processed today

| Category | Source | Purpose | Lawful basis | Retention |
| --- | --- | --- | --- | --- |
| Server/request logs (may include IP) | Visiting the public site | Security, availability, abuse prevention | Legitimate interests (Art 6(1)(f)) | _to be completed_ |
| Contact enquiries | User contacting the operator | Responding | Legitimate interests / pre-contract | _to be completed_ |

No cookies or tracking technologies are in use; no analytics that identify
individuals; no source code is processed.

## Measurement and telemetry

Five kinds of measurement exist, and they are kept separate (#28–#32):

- **Engine evaluation** (#30): precision, recall, error rates, calibration,
  evidence coverage and sample size per rule and language, from controlled
  evaluation corpora. Needs no user tracking and no customer source code.
  Snapshots are versioned and dated; quality is never collapsed into one
  opaque score.
- **Operational monitoring**: latency, rule-execution failures and contract
  validity via the engine's injected instrumentation, which is off unless a
  composition root explicitly provides it.
- **Web product analytics** (#31): server-side, first-party aggregates only —
  request counts, failure rate, latency percentiles, abandonment, and
  aggregate language/rule-selection distributions, served at `GET /metrics`.
  No source code, prompts, findings, repository names, identifiers or
  cookies. Every recorded event is scanned against the forbidden-key list,
  so a future metric cannot silently start retaining sensitive data.
- **CLI**: no telemetry by default. Local usage stays local unless the user
  explicitly opts into future telemetry.
- **Public exemplars** (#32): educational, opt-in showcase entries for named
  repositories/files. Private/customer code is never exposed, individual
  developers are never ranked, and owners can request correction or removal.

## Data subject rights

Access, rectification, erasure, restriction, portability, objection, and the
right to lodge a complaint with the Spanish AEPD or another EU supervisory
authority. Request workflow: _to be completed_ (see #29).

## International transfers

Infrastructure defaults to AWS `eu-west-1` (Ireland). Any transfer outside the
EEA (e.g. a future non-EU subprocessor) requires a documented mechanism; see
[subprocessors.md](subprocessors.md). Hosting region is not offered to users as
a residency guarantee.

## AI-assisted processing

Not applicable in the current mode. When AI-assisted analysis is introduced,
[ai-transparency.md](ai-transparency.md) and this notice are updated together.

## Changes

This notice is updated in the same commit as any product change that alters
what personal data is processed or why.
