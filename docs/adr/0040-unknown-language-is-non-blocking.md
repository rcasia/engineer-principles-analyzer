# ADR-0040: Run unknown languages as "unknown" instead of blocking

**Status**: Accepted (Supersedes [0028](0028-jev-language-detection.md) blocking behaviour, [0026](0026-auto-detect-language-only.md) rejection path)
**Date**: 2026-09-23

## Context

Until now an unidentified language blocked analysis everywhere: the CLI asked for `--language` when neither the flag nor the filename named one, and the web `POST /analyze` 400d with "Could not detect the programming language" when Jev answered `other` or failed. The six-language allow-list plus ambiguous snippets (`class Foo {}`, `hello world`) therefore rejected valid submissions even though the underlying SOLID concepts are language-general and the Jev-backed rules judge source generically.

## Decision Drivers

- A wrong guess is still worse than asking, but asking is worse than running generically: heuristic rules already know how to say `not_applicable` for out-of-scope languages, and Jev rules carry no language allow-list at all.
- The domain has no I/O and `Subject.language` must stay non-empty; the fallback must be a first-class sentinel both adapters share, not an empty string that fails validation.
- Offline-first CLI must stay offline: no content heuristics, no network, just extension → `unknown`.

## Considered Options

### Option 1: Keep blocking, improve the message (rejected)

- **Pros**: No contract change; smallest diff.
- **Cons**: Keeps rejecting code Jev could already judge; the message does not fix the retry cost.

### Option 2: Run as "unknown" (chosen)

- **Pros**: One sentinel (`"unknown"`) through `Subject`, `AnalysisResult`, events and metrics; heuristic rules degrade to `not_applicable` (already tested), Jev rules judge generically; CLI and web share parity; no new inference cost.
- **Cons**: Heuristic-only runs on `unknown` return `not_applicable` rather than a verdict — honest but not useful until Jev rules ship in the default catalog; metrics bucket changes from `undetected` to `unknown`.

### Option 3: Guess the closest language (rejected)

- **Pros**: Heuristics always produce a verdict.
- **Cons**: Reintroduces the misattribution ADR-0025/0026 removed; a wrong language silently corrupts every verdict downstream.

## Decision

Option 2: `core` exports `UNKNOWN_LANGUAGE = "unknown"`. `JevLanguageDetector` still returns `undefined` for `other`/blank/failure, but callers map it to `"unknown"` and proceed. The CLI resolves missing → `"unknown"` (explicit `unknown` accepted, explicit outside the six still rejected). The web runs undetected/Jev-failure/keyless as `"unknown"` with 200. Only empty source still 400s. `POST /detect` keeps answering `""` for the badge preview; the submit verdict is authoritative.

## Consequences

### Positive

- No more language 400s for non-empty submissions; `hello world` analyzes instead of blocking.
- Web/CLI parity holds for `unknown`: identical `not_applicable` heuristic findings.
- Jev-backed rules (`solid.srp.jev` and followers) work without a language allow-list change.

### Negative

- Heuristic findings on `unknown` are `not_applicable` by design — callers must read that as "out of scope for this rule", not as approval.
- `--language haskell` still rejects; only the unidentified case is non-blocking, not the explicitly unsupported one.
- Deployed check no longer accepts a keyless 400; keyless now 200s as `unknown`.

### Risks and mitigations

- **Unknown hides a detectable language**: mitigated by keeping the six-language detector unchanged — `unknown` only fires when Jev already said `other` or failed.
- **Metrics discontinuity (`undetected` → `unknown`)**: accepted — one bucket, renamed; dashboards update once.
