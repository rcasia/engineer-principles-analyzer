# ADR-0025: Detect the submission language from filename and content

**Status**: Accepted
**Date**: 2026-09-20

## Context

`POST /analyze` required an explicit free-text `language` field: an empty
or missing value failed `Subject` validation with a 400, even when the
language was obvious from the uploaded filename (`main.py`) or the pasted
source (`def greet(name):`). Visitors who uploaded a file had to retype
what the filename already said, and pasted snippets with no language were
rejected instead of analyzed.

## Decision Drivers

- The language input is the most common avoidable rejection on the
  submission form; removing it must not weaken `Subject`'s invariants.
- Detection must stay dependency-free and purely textual (ADR-0008,
  ADR-0022): no parsers, no network calls, no I/O.
- A wrong guess is worse than asking: misattributing the language corrupts
  every downstream verdict, while a 400 with guidance costs one retry.
- The domain owns pure rules; adapters own request plumbing (ADR-0002).

## Considered Options

### Option 1: Pure content heuristics in core, wired as a fallback in the web adapter

- **Pros**: Explicit languages keep working byte-for-byte; detection only
  runs when the visitor left the field blank. Unknown input still 400s,
  now with a message that says what to do. `Subject` and
  `AnalysisResult` invariants are untouched.
- **Cons**: Two code paths to the same `Subject` (explicit vs detected);
  ambiguous snippets still need the field.

### Option 2: Make `Subject.language` optional and detect inside core

- **Pros**: One path; every adapter gets detection for free.
- **Cons**: Weakens the `Subject` contract every rule relies on, changes
  validation semantics for existing callers, and pushes filename concerns
  (an adapter concept) into the domain.

### Option 3: Filename-extension mapping only, in the web adapter

- **Pros**: Smallest change; extensions are reliable intent signals.
- **Cons**: Pasted text — the primary playground flow — has no filename,
  so the most common rejection would remain.

## Decision

Option 1: a new pure domain module,
`engine/domain/language-detection.ts`, exposing `languageForFilename`,
`languageForSource`, and `detectLanguage` (extension first, then
distinctive content signals, otherwise `undefined`). The web adapter
resolves the effective language — typed value, else detection over the
uploaded filename and source — and only 400s when detection also draws a
blank, with "Could not detect the programming language. Please enter one
explicitly." `Subject.of` still rejects empty languages; it now simply
receives fewer of them.

## Consequences

### Positive

- Uploads like `main.py` and recognizable pastes analyze with the language
  field left blank; the toolbar input shows an `auto-detect` placeholder.
- Explicit input always wins, so existing bookmarks, examples, and API
  callers are unaffected.
- Detection is unit-tested to the mutation gate like any other domain rule.

### Negative

- Heuristic signals are English-keyword-shaped and cover six languages
  (typescript, javascript, python, go, rust, java); anything else still
  needs the field, and a bare `class Foo {}` is deliberately undetectable
  rather than guessed.
- `languageForSource` checks run most-distinctive-first, so adding a
  language later means re-examining the ordering, not just appending.

### Risks and mitigations

- **Misdetection routes code to the wrong rule path**: mitigated by
  choosing signals that are rare outside their language
  (`System.out.println`, `println!`, `if __name__`) and returning
  `unknown` below one signal instead of guessing.
- **Extension/content disagreement**: the extension wins as the stronger
  intent signal; a misleadingly named file can still be overridden by
  typing the language explicitly.
