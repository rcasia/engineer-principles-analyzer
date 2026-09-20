# ADR-0026: Auto-detect the submission language with no manual override

**Status**: Accepted (Supersedes [0025](0025-language-detection.md))
**Date**: 2026-09-20

## Context

ADR-0025 kept the free-text `language` field as an explicit override with
detection as a fallback: typed value wins, otherwise `detectLanguage` over
the uploaded filename and source. The field was the most common avoidable
rejection, and leaving two paths to the same `Subject` meant every
submission had to be reasoned about twice (explicit vs detected).

## Decision Drivers

- One path to `Subject`: fewer branches, fewer tests, fewer ways to disagree.
- A wrong explicit value is worse than a 400: it silently misattributes the
  analysis, while detection either finds a distinctive signal or asks for
  more evidence.
- The playground has no client-side JavaScript (ADR-0004), so the form
  cannot preview detection — the server is the single place that decides.

## Considered Options

### Option 1: Remove the field, always detect (chosen)

- **Pros**: Single code path; the form cannot submit a contradicting
  language; `POST /analyze` ignores any `language` value it still receives
  for backward compatibility.
- **Cons**: Ambiguous snippets (`class Foo {}`, `hello world`) now always
  400 instead of being rescuable by typing; the error message must teach
  the visitor to add distinctive code or a known filename extension.

### Option 2: Keep the field as an optional override

- **Pros**: Status quo from ADR-0025; ambiguous pastes stay rescuable.
- **Cons**: Two paths forever; a mistyped override corrupts every verdict
  downstream; the UI keeps implying the visitor must know the answer.

## Decision

Option 1: the web adapter resolves the language solely with
`detectLanguage(sourceCode, filename) ?? ""`. Any `language` form field is
ignored. The blank form shows `Auto-detect` with `snippet.txt`; examples
display their detector-produced language. Undetectable non-empty
submissions 400 with "Could not detect the programming language. Please
include more distinctive code or upload a file with a known extension."
Empty source still reports "sourceCode must not be empty."

## Consequences

### Positive

- `POST /analyze` has one language path; explicit-vs-detected tests go away.
- The toolbar no longer asks the visitor to classify their own code.

### Negative

- Six heuristic languages only (typescript, javascript, python, go, rust,
  java); anything else must arrive with a known extension or distinctive
  signals, or it is rejected.
- `DEFAULT_LANGUAGE` is removed; the blank form no longer implies
  TypeScript.

### Risks and mitigations

- **Detection gap rejects valid code**: mitigated by the guidance in the
  400 message and by extension-first detection for uploads.
- **Stale callers still send `language`**: mitigated by ignoring the field
  rather than rejecting it, covered by a test that sends `language: go`
  with Python evidence and asserts `python` wins.
