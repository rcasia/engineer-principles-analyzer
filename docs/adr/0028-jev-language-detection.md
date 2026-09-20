# ADR-0028: Detect the submission language with Jev Choice

**Status**: Accepted (Supersedes [0026](0026-auto-detect-language-only.md))
**Date**: 2026-09-20

## Context

ADR-0026 made detection fully automatic but kept it a dependency-free
textual heuristic: extension lookup, then a handful of hand-picked content
signals per language, with anything ambiguous 400ing. The catalog is six
languages, every new language means new regexes plus precedence arguments,
and near-miss snippets (`class Foo {}`) are rejected even when a human —
or a model — would read them fine.

Meanwhile ADR-0024 proved the Jev integration shape (port, pure
request/response functions, HTTP and in-memory adapters) against the SRP
rule. Language detection is the textbook case for the remaining primitive:
a Choice question ("one of a defined set", per the `typesafe-ai` skill)
over the submission, with an explicit no-match option.

## Decision Drivers

- Detection quality should grow with the model, not with our regex list.
- The domain has no I/O: an async judgment cannot live in
  `engine/domain/` next to the old heuristic.
- Every submission pays for one inference: latency, cost, and an API key
  move onto the submission path, including page renders that used to be
  free.
- Offline development and tests must keep working without a credential.

## Considered Options

### Option 1: Extension stays, Jev judges content only (rejected)

- **Pros**: Deterministic fast path; uploads with known extensions never
  pay for inference; smaller blast radius.
- **Cons**: Two detectors to reason about forever; a misleading extension
  still wins silently; the heuristic signals remain to be maintained.

### Option 2: Full Jev replacement (chosen)

- **Pros**: One language path; filename and source travel together as the
  judgment state; no signal lists or precedence rules to maintain; new
  languages are a criteria entry, not a parser change.
- **Cons**: Every POST pays one SystemOne call; the playground needs
  `TYPESAFE_API_KEY` to run at all; a Jev outage reads as "undetected".

### Option 3: Jev first, heuristic fallback on failure (rejected)

- **Pros**: Degrades gracefully without a key or during an outage.
- **Cons**: Keeps the entire heuristic we wanted to delete, plus the
  precedence question of which answer wins when they disagree; two code
  paths to the same `Subject`, the exact duplication ADR-0026 removed.

## Decision

Option 2: the heuristic module is deleted. A `JevLanguageDetector`
application service asks one Choice question per non-blank submission —
state `{ sourceCode, filename }`, options `typescript`, `javascript`,
`python`, `go`, `rust`, `java`, plus an explicit `other` no-match outcome
— and maps `other` to `undefined` so callers keep the "ask for more
evidence" path. Blank sources resolve without a request. Jev failures
propagate; the web adapter maps them to the undetected-language 400 rather
than a 500.

Supporting changes in the `jev` slice: `evaluateChoice` on the port, a
Choice request builder and strict Choice response parser in `domain/`, and
both adapters extended (the in-memory adapter replays a separate choice
script with its own cursor, defaulting to `other`).

`GET /analyze?example=` does not detect: it renders the example's curated
`language` field, so prefilled pages never wait on (or pay for) inference.
Detection runs on POST only — submit (`POST /analyze`) and preview
(`POST /detect`, below).

The live island cannot bundle the verdict: Jev needs `TYPESAFE_API_KEY`,
which must never reach the browser. Instead the island asks the server —
`POST /detect` with `{ sourceCode, filename }`, answered as `{ language }`
(`""` when unknown, including on Jev failures) — on paste and when a
buffer loads unknown. Never per keystroke: typing only re-highlights and
re-counts locally. The badge is a preview; the submit verdict is
authoritative, so a preview that cannot tell simply keeps auto-detect.

## Consequences

### Positive

- No signal lists, no precedence rules, no extension table to maintain.
- The `other` option makes "unknown" a first-class verdict instead of the
  absence of a regex hit.
- Tests script the judgment through the same port production uses; no
  credential needed for `bun run check`.

### Negative

- Six Choice languages only, same list as before — widening it is a
  criteria change, but still a change.
- POST /analyze costs one SystemOne call and its latency; `TYPESAFE_API_KEY`
  is now required to serve the web UI locally and in Lambda (both
  composition roots fail fast without it).
- The live badge can lag the verdict: it only refreshes on paste and load,
  and typing a whole program leaves the preview stale until submit.
- Confidence is recorded in the judgment but not gated: the top option
  wins however flat the distribution. A cutoff is future work once real
  verdicts show the boundary matters.

### Risks and mitigations

- **Jev outage 400s every submission**: mitigated by degrading to the
  undetected guidance instead of a 500, covered by a web test with an
  exhausted script.
- **Jev mislabels a submission**: worse than a 400 — a wrong language
  silently misattributes the analysis. Mitigated by the same disclosure
  posture as ADR-0024 (probabilities and model are on the wire for future
  logging) and by keeping the guidance message so ambiguous pastes still
  fail loudly via `other`.
- **Lambda has no `TYPESAFE_API_KEY` yet**: the cold start throws until
  infra provides it; noted as a known gap, not silently defaulted.
- **Example pages show curated language, POST may disagree**: accepted —
  examples are fixed TypeScript Jev reads as such; a mismatch would be a
  detection bug worth knowing about.
