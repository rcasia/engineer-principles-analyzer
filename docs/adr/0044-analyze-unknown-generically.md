# ADR-0044: Analyze unknown languages generically instead of reporting not_applicable

**Status**: Accepted (Supersedes [0040](0040-unknown-language-is-non-blocking.md) heuristic behaviour)
**Date**: 2026-09-26

## Context

ADR-0040 made an unidentified language non-blocking: Jev's `other`, a Jev
failure, or a missing `TYPESAFE_API_KEY` all run as `"unknown"` with 200
instead of 400. The default catalog, however, holds only heuristic rules,
and every one of them gated on an explicit language allow-list — so a
keyless deploy (the infra default: `typesafe_api_key = null`, LocalStack,
CI) analyzed every submission as five `not_applicable` deterministic 100%
findings, e.g. `solid.srp: "This rule does not yet know how to detect
class-shaped constructs in "unknown"."`.

That is honest but not useful, and ADR-0040 named it as such: "honest but
not useful until Jev rules ship in the default catalog". The Jev probe
(`solid.srp.jev`) exists but stays a validation adapter, not a production
rule — so the "until" never arrived, and pasted TypeScript with no filename
never got a real verdict.

## Decision Drivers

- The language label is a hint, not a precondition: the OCP/LSP/ISP/DIP
  assessments read only `sourceCode` (switch counts, `extends`, interface
  members, imports), and SRP's brace extractor reads `class Name { ... }`
  in any brace language. Only Python needs a distinct interpretation.
- A wrong-language guess is still worse than asking (ADR-0025/0026), but
  "unknown" is not a guess — it is the absence of a claim. Running the
  generic shape detectors on it cannot misattribute a language.
- Explicitly unsupported languages (Go, Rust for SRP; Python for OCP/LSP/
  ISP/DIP) must stay `not_applicable`: knowing the language is Go and
  knowing nothing are different facts.

## Considered Options

### Option 1: Keep gating on the allow-list, wire Jev rules into the catalog (rejected)

- **Pros**: No heuristic change; `unknown` gets AI verdicts as ADR-0040 foresaw.
- **Cons**: Every analysis pays Jev cost/latency per rule, not just per
  detection; keyless deploys degrade to `unable_to_analyze` instead of
  `not_applicable` — worse. The Jev probe is documented as validation-only.

### Option 2: Restore offline content heuristics for detection (rejected)

- **Pros**: Pasted TypeScript would detect as `typescript` without Jev.
- **Cons**: Reintroduces the regex list and precedence rules ADR-0028
  deleted; still fragile for ambiguous snippets; two detectors to reason
  about. Detection quality should grow with the model, not our regexes.

### Option 3: Run heuristics generically on unknown (chosen)

- **Pros**: Keyless and Jev-failure runs produce real verdicts today with
  no new inference cost; provenance still reports `"unknown"` so nothing
  claims a language it did not detect; explicit unsupported languages keep
  their `not_applicable` scope facts.
- **Cons**: An `unknown` TypeScript file and an `unknown` Java file share
  the brace interpretation — correct for the current extractors, but a
  future language needing its own extractor will need an explicit branch
  here rather than falling through silently.

## Decision

Option 3: each heuristic rule treats `UNKNOWN_LANGUAGE` as "run
generically" rather than "out of scope":

- OCP, LSP, ISP, DIP run their existing source-only assessment for
  `"unknown"` exactly as for TypeScript/JavaScript.
- SRP tries brace-shaped classes first for `"unknown"`, then Python's
  indentation shape when no brace class was found; method interpretation,
  evidence shape (`{ … }` vs `: …`) and remediation noun
  (`collaborator(s)` vs `module(s)`) follow the shape that was found,
  while the result's `language` stays `"unknown"`.
- Any other unsupported language keeps the existing `not_applicable`
  deterministic scope fact unchanged.

## Consequences

### Positive

- Pasted code with no filename gets heuristic verdicts (`violation`,
  `uncertain`, `compliant`) instead of five language-gate
  `not_applicable` findings; `not_applicable` on `unknown` now means "no
  construct found", a real scope fact about the code.
- CLI and web share the improvement: both resolve unidentified submissions
  to `"unknown"` and run the same engine.
- No new I/O, no new cost, no domain-boundary change: detection still
  lives in `application/`, rules still read only `Subject`.

### Negative

- `--language haskell` still rejects; only the unidentified case is
  generic, not the explicitly unsupported one.
- A future language whose constructs need a third extractor will report
  `not_applicable` ("no construct found") on `unknown` until that
  extractor is added to the fallback — a silent-ish gap mitigated by the
  corpus (#27) and by keeping the explicit-language path authoritative.

### Risks and mitigations

- **Generic brace scan misreads a non-brace unknown file**: mitigated by
  trying the Python shape when no brace class is found, and by reporting
  `not_applicable` when neither shape matches rather than forcing a verdict.
- **Metrics continuity**: `unknown` bucket unchanged; only the status mix
  inside it shifts from all-`not_applicable` to real verdicts.
