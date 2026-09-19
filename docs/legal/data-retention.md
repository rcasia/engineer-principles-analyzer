# Data Retention and Deletion (DRAFT — not in force)

> **Status:** Draft skeleton. Not published, not binding.

**Classification:** Public + customer-contractual.
**Assumed product mode:** Analysis is ephemeral by default; nothing customer
-specific is persisted today.

## Principle

Analysis is **ephemeral by default**: source code and analysis results are not
persisted unless a specific feature explicitly requires retention, and each
such feature documents its own category here before shipping.

## Retention schedule

| Data category | Persisted? | Location | Retention period | Deletion mechanism |
| --- | --- | --- | --- | --- |
| Submitted source code | No (ephemeral) | In-memory during request | Not retained after response | N/A |
| Analysis results | No (ephemeral) | In-memory during request | Not retained after response | N/A |
| Server/request logs | _to be completed_ | AWS `eu-west-1` | _to be completed_ | _to be completed_ |

## Event sourcing note

Per ADR-0012 and #33, the append-only event history must **not** contain raw
source code, prompts, credentials or complete findings by default. Minimal
event metadata is separated from sensitive artifacts, which carry their own
retention/deletion policy. Deletion must be able to remove or
cryptographically invalidate sensitive artifacts even when the minimal event
envelope is retained for audit/integrity. Document the lawful purpose and
retention period for event history. Never use event history for individual
developer performance ranking.

## Deletion workflow

Data-subject/customer deletion workflow: _to be completed_ (must exist before
persistent project storage — see the #28 sequencing).
