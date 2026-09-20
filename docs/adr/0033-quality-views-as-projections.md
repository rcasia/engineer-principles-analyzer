# ADR-0033: Treat quality metrics, snapshots and exemplars as projections

**Status**: Accepted
**Date**: 2026-09-20

## Context

#30 (evaluation snapshots), #31 (web product metrics) and #32 (public
exemplars) each introduce a new queryable view. Without a shared rule, every
new view risks becoming its own mutable store with its own retention story —
exactly the coupling ADR-0012 was written to avoid. #28 adds the other half
of the constraint: an append-only history must never become a permanent copy
of customer source code, prompts or credentials.

## Decision Drivers

- New measurement views must not create new sources of truth.
- The event history must stay free of source code, prompts, findings and
  credentials (#28 "Sensitive data", #33 acceptance criteria).
- Read models must be disposable and rebuildable (ADR-0012).
- The CLI stays telemetry-free by default; measurement is opt-in or
  server-side aggregates only.

## Considered Options

### Option 1: Each view owns a mutable store

Every feature persists its own current-state records.

- **Pros**: each slice is self-contained; no replay plumbing needed.
- **Cons**: three new sources of truth; retention/deletion must be reasoned
  per store; a store holding findings or source becomes a second place
  customer content lives, against #28.

### Option 2: Quality views as projections over minimized events

`WebMetrics`, evaluation snapshots and exemplar publication states are read
models folded from privacy-minimized events (`AnalysisRequested`,
`AnalysisCompleted`, `AnalysisFailed`, `EvaluationSnapshotPublished`-shaped
facts). Events carry identifiers, versions, counts and hashes — never source,
prompts, findings or credentials. Sensitive artifacts live in a separate
store with their own retention; the event envelope stays.

- **Pros**: one retention story (minimal envelope vs. sensitive artifact);
  projections rebuild from scratch; no second copy of customer content;
  matches the engine's existing event shapes, which already exclude source.
- **Cons**: projections that need durations or rule ids depend on those facts
  being in the event at append time; in-memory projections (Lambda) do not
  survive cold starts until a durable adapter exists — the same accepted gap
  as `InMemoryEventStore` in ADR-0015.

## Decision

Option 2. Quality, metrics and exemplar views are projections, not stores:

- `WebMetrics` folds `analysis-requested/completed/failed` facts carrying
  only outcome, language, executed rule ids and duration; the summary is
  served at `GET /metrics` and rebuilt by replaying the stream.
- Evaluation snapshots pin principled/rule/corpus versions, methodology,
  date, per-rule per-language rates, calibration, evidence coverage, sample
  size and limitations; publishing refuses customer data via #28's
  forbidden-key guard.
- Exemplar entries reference public code by permalink with explicit owner
  consent; there is no field for raw source, developer identity or ranking,
  and correction/removal are state transitions on the entry.
- No view collapses quality into a single opaque score; no view ranks
  individual developers.

## Consequences

### Positive

- Deleting sensitive artifacts does not require rewriting history: the
  minimal envelope remains valid for audit while the artifact is removed or
  cryptographically invalidated.
- New read models (e.g. a public evaluation page) can be built without
  touching the write side.
- The CLI contract is untouched: nothing here emits telemetry on its own.

### Negative

- In-memory projections lose history on cold start; operators must not read
  them as durable records until a durable event store lands.
- Event schema discipline is load-bearing: any fact a future projection
  needs must be appended now, because past streams cannot be amended.

### Risks and mitigations

- A future metric smuggles sensitive data into an event: mitigated by the
  #28 forbidden-key scan at record sites and by review of every event-shape
  change against `docs/legal/data-retention.md`.
- Employment-adjacent reuse of aggregates (developer rankings, team
  dashboards): explicitly out of scope; reassess AI Act classification and
  paused publication if such a use is ever proposed (see
  `docs/legal/ai-transparency.md`).
