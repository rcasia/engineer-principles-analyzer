# ADR-0042: Analyze live on /analyze with no submit button

**Status**: Accepted
**Date**: 2026-09-23

## Context

The `/analyze` playground is submit-driven: the visitor types, presses
**Analyze →**, waits for a full-page `POST`, and lands on a separate
findings page. The editor island (ADR-0029) already highlights, counts and
detects live — but the verdict itself still needs a button and a round
trip, which is exactly the interaction the page exists to demo. The product
request is a realtime, interactive page with no analyze button at all:
findings appear below the editor as you type, upload, or try an example.

Since ADR-0040 an unidentified language runs as `"unknown"` instead of
blocking, so the live loop has no dead ends: every non-empty buffer gets
findings, and the only rejection left is the empty buffer.

## Decision Drivers

- **One route, no new infrastructure.** `POST /analyze` already travels
  through the Lambda@Edge body signer (ADR-0019) with `no-store` semantics.
  A second JSON route would need the same signer, cache-policy and deploy-
  check review for a representation of the same run.
- **The no-JS baseline must keep working** (ADR-0023): with scripting
  disabled the page still submits and still shows findings.
- **The mutation gate covers the new client code like any other module**
  (ADR-0003): the live island needs deterministic, timer-injectable seams,
  not hand-waved async behaviour.
- **Metrics and event-store semantics do not change**: a live run is a run
  like any other — minimized facts only, never source.

## Considered Options

### Option 1: Auto-submit the form on debounce

Keep the single HTML representation; the island submits the form ~500 ms
after the visitor pauses.

- **Pros**: Zero server change; no second renderer; the no-JS and JS paths
  are literally the same request.
- **Cons**: Every pause reloads the page — editor focus, caret, scroll and
  undo history are destroyed by the feature meant to feel instant; browser
  history fills with one entry per pause; the findings page replaces the
  editor instead of sitting beside it. Rejected: it is realtime in name
  only.

### Option 2: A new `POST /api/analyze` JSON route

A dedicated API beside the page route, with the island rendering the
answer.

- **Pros**: Clean separation of page and API; content negotiation hacks
  avoided.
- **Cons**: A second POST path through CloudFront and the edge signer needs
  its own cache behaviour, deploy check and abuse review for what is the
  same run in a different envelope. Rejected: new infrastructure surface
  for no new capability.

### Option 3: Content negotiation on `POST /analyze` plus a live island (chosen)

A JSON request body to the existing route gets a JSON answer —
`{ language, results }` on success, `{ error, language }` on rejection
(empty buffer only: an unidentified language runs as `"unknown"` with 200
per ADR-0040) — with the same detection, validation, metrics and
event-store append as the page render, factored through one shared
`settleAnalysis` step. The island
debounces input, skips empty and unchanged buffers, guards races with
monotonic request ids, and renders into an `aria-live` findings region with
a `role="status"` toolbar line. The submit button is removed; a
`<noscript>` submit button inside the same form keeps the no-JS baseline
working with zero JS-visible chrome.

- **Pros**: No new route, no signer or cache-policy change; page and JSON
  cannot drift because they settle through one function; the island is a
  small, fully tested module in the existing bundle (no manifest, build or
  deploy change).
- **Cons**: Finding markup now has two renderers — the server template
  (no-JS) and the island renderer (live) — which can drift visually; the
  status strings and the plain-result shape are shared by construction, the
  class names only by mirrored tests.

## Decision

Option 3, with these specifics:

- **Debounce 500 ms** (`LIVE_ANALYSIS_DEBOUNCE_MS`, literal-tested): one
  pause costs one request; typing never fires.
- **Skip empty and unchanged buffers**: whitespace-only input renders the
  empty state with no request; re-picks of identical content render nothing.
- **Race guard, not cancellation**: each run takes the next request id and
  only the latest id may render. Aborting would save server work but adds
  `AbortController` failure modes the id guard does not have.
- **Unknown is just another language**: a buffer Jev cannot identify
  analyses as `"unknown"` (badge `Unknown`, filename `snippet.txt`) like
  any completed run — the paused status is reserved for an unreachable
  service, never for a language.
- **Status is shared strings, not shared markup**: `analysis-payload.ts`
  owns `LIVE_STATUS_*` and the empty-state message for both page and
  island; the finding HTML is mirrored (server template vs island
  renderer) with the badge classes and summary wording pinned by tests on
  both sides.
- **Uploads read into the editor**: the island reads the chosen file with
  `file.text()` into the textarea, so the visible buffer is always what is
  being analysed — the server's "file wins over textarea" preference stays
  untouched for the no-JS post.
- **Examples schedule, never navigate**: the island listens alongside the
  editor's fill handler and analyses the filled buffer after a tick; with
  the editor absent the plain navigation still works.

## Consequences

### Positive

- Typing, uploading or trying an example updates findings in place: no
  button, no navigation, no lost caret. The toolbar shows language, line
  count and a live status (`Waiting for code.` / `Analyzing…` /
  `Findings up to date.` / `Analysis paused — see below.`).
- The no-JS page still submits via the `<noscript>` button and still gets
  the full findings page — the accessibility and resilience baseline is
  preserved, not just the appearance of one.
- Live runs flow through the same metrics and event-store path, so
  `GET /metrics` and replay semantics need no amendment.

### Negative

- Two finding renderers must be kept visually consistent by test
  discipline; a redesign of the finding card touches both.
- Metric and Jev request volume grows with pauses, not submits. Debounce
  bounds it, and both sinks already carry only minimized facts — but the
  per-keystroke cost model should be re-measured if the debounce ever
  drops.
- The client bundle grows by the island (~fetch, render, wiring); the
  existing immutable-asset pipeline absorbs it with no config change.

### Risks and mitigations

- *Risk*: A slow response renders over a newer buffer. *Mitigation*: the
  request-id guard, proven by a test that resolves two runs out of order.
- *Risk*: Screen readers get a verbose live region on every keystroke
  pause. *Mitigation*: findings sit in `aria-live="polite"` while the
  concise `role="status"` line announces state; the debounce, not the
  keystroke, drives announcements.
- *Risk*: The mirrored renderers drift. *Mitigation*: identical class
  names and summary/note wording asserted on both sides; the shared
  constants module makes string drift a type error or a failing literal
  test.
- *Risk*: A future rule picker wants per-rule live toggles. *Mitigation*:
  the engine already selects by `ruleIds`; the JSON request shape can grow
  an optional `ruleIds` field without changing the route.
