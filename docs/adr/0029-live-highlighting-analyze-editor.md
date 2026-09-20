# ADR-0029: Live language detection and syntax highlighting on /analyze

**Status**: Accepted (Partly supersedes [0004](0004-server-rendered-web-without-client-javascript.md))
**Date**: 2026-09-20

## Context

Since ADR-0026 the visitor has no language control: the server detects
from filename and content on submit. That leaves the playground itself
blind — the badge reads "Auto-detect" until the round trip, and the code
sits uncoloured. A `<textarea>` cannot render colours, so any live
feedback needs client-side JavaScript, which ADR-0004 forbids. The client
island pipeline (`scripts/build-client.ts`, hashed immutable bundles)
exists but serves nothing yet.

## Decision Drivers

- The badge must never disagree with the analysis: detection has exactly
  one implementation, shared by server and client.
- No-JS remains the baseline: the form submits, detects, and analyses
  with scripting disabled; JavaScript only enhances.
- Few moving parts (ADR-0001): no framework, no CDN third-party script,
  no new infrastructure — the bundle ships inside the existing Lambda zip.
- The mutation gate covers the island like any other module.

## Considered Options

### Option 1: highlight.js island with core detection (chosen)

- **Pros**: highlight.js 11.12.0 is BSD-licensed, dependency-free, and
  imports per language — core plus the six detected languages
  (typescript, javascript, python, go, rust, java) bundles to ~53 kB.
  Detection stays in core (`detectLanguage`), so client and server agree
  by construction; highlight.js only colours via `highlight` with
  `ignoreIllegals`, never `highlightAuto`, so its relevance heuristics
  cannot route anything. Tested in microseconds with happy-dom, same as
  the gutter island.
- **Cons**: A third-party grammar set to keep current; highlight.js
  class names (`hljs-keyword`, …) become part of the design system.

### Option 2: Shiki (VS Code grammars)

- **Pros**: Most accurate colours, same engine as the editor.
- **Cons**: WASM payload an order of magnitude larger, server-side
  focused, overkill for six languages behind a textarea overlay.

### Option 3: Server-rendered highlighting only, no client JS

- **Pros**: ADR-0004 untouched; evidence blocks and examples could ship
  colours with zero scripting.
- **Cons**: No live feedback while typing — the actual request — and a
  textarea still cannot show colours, so the editor itself stays blind.

## Decision

Option 1, as strict progressive enhancement on `/analyze` only:

- `packages/web/src/client/analyze-editor.ts` detects on every keystroke
  with core `detectLanguage` (uploaded filename included), colours a
  `<pre>` backdrop behind a transparent textarea, and updates the badge,
  filename, status bar, and gutter live. Without its elements it returns
  `false` and touches nothing.
- The overlay styles apply only under an `editor--live` class the island
  adds, so the no-JS form keeps a normal visible textarea.
- The server renders `<script type="module" src="/assets/…">` only when
  a bundle was loaded at startup (`ClientAssets`), serves it by exact
  filename match with immutable caching, and otherwise renders the plain
  form. `bin.ts` and `lambda-entry.ts` load the bundle from disk (build
  output dir / zip siblings); nothing is fetched per request.
- `build-client.ts` bundles both islands with a manifest;
  `build-lambda.ts` preserves the client directory and zips the assets
  beside the handler; `infra:plan` / `infra:apply:local` build the client
  first. `check-deployed.ts` asserts the script tag on the live page.

## Consequences

### Positive

- Typing Python turns the badge to "Python" and colours the buffer
  before submit; ambiguous input stays honestly "Auto-detect".
- The no-JS baseline is asserted, not assumed: no bundle means no
  `<script>` tag, and that state has tests.
- The island pipeline finally serves something, validating the Phase 1
  spike's design end to end.

### Negative

- ADR-0004's "no client-side JavaScript" now reads "no *required*
  client-side JavaScript": one page ships ~53 kB of progressive
  enhancement, and the design system carries highlight.js theme classes.
- `highlight.js` is a new runtime dependency of `@principled/web` to
  audit (clean at introduction); grammar updates arrive via Dependabot
  like any other dep.

### Risks and mitigations

- **Overlay drift** (backdrop/textarea misalignment on wrap or zoom):
  mitigated by identical font/padding on both layers, synced scroll, and
  keeping the textarea the single input — the backdrop is `aria-hidden`.
- **A wrong live badge**: impossible by construction — the island calls
  the same `detectLanguage` the submission path uses.
- **Half-typed code throwing**: `ignoreIllegals: true` plus a plaintext
  fallback; covered by a mid-keystroke test.
- **Forced-colors mode**: hljs spans inherit the UA override like all
  other coloured text; the textarea remains fully operable.
