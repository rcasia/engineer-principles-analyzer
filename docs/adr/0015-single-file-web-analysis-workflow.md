# ADR-0015: Analyze a single source file on the web without client JavaScript

**Status**: Accepted
**Date**: 2026-09-19

## Context

`AnalyzeSubject` (#9, ADR-0014) can already run every registered rule
against one `Subject` and return a `results`/`events` pair, but nothing
calls it. #34 asks for the first real caller: a web page where someone
pastes or submits one source file, runs an analysis, and sees loading,
success and error states for structured findings — without the page ever
persisting their source.

Two constraints from earlier ADRs shape every option here:

- **No client-side JavaScript** (ADR-0004): the page must work with
  scripting disabled, which rules out `fetch`, a spinner driven by a
  pending promise, or polling a job status endpoint from the browser.
- **The engine's events are shaped for replay, but nothing replays them
  yet** (ADR-0014, "Risks and mitigations"): `AnalyzeSubject` produces
  `AnalysisRequested`/`Completed`/`Failed` events and hands them to the
  caller instead of appending them, explicitly deferring "a real
  `EventStore` and a real caller" to this issue.

## Decision Drivers

- **Findings must show status, confidence, explanation, evidence and
  source locations when available.** Only the `AnalysisResult` values
  `AnalyzeSubject.execute` returns synchronously carry all of that — the
  event payloads are deliberately more minimal (ADR-0013's
  evidence-minimization requirement, #28) and do not carry `explanation`,
  `evidence` or `remediation` at all.
- **Submitted source must not be persisted by default.** No file, database
  row, or event payload may hold the pasted/uploaded source or an
  unbounded excerpt of it, anywhere in this workflow.
- **A no-JS page cannot show a client-driven loading spinner.** Whatever
  "loading state" means here has to be true of a page that never runs a
  script.
- **"The design must allow replay" needs an actual passing test now**,
  not just a claim about event shape, per ADR-0014's own risk log.

## Considered Options

### Option 1: A single POST handler; render results or a validation error, and never touch an `EventStore`

The web handler builds a `Subject`, calls `AnalyzeSubject.execute`, and
renders `results` directly. `events` is discarded.

- **Pros**: Simplest possible slice; nothing new to test on the
  event-sourcing side.
- **Cons**: Leaves ADR-0014's "nothing yet appends `AnalysisRun.events`
  anywhere" risk exactly where it was — this issue was named as where that
  gets resolved, and declining to do so here means no consumer will ever
  have appended one of these streams for real.

### Option 2: Poll a job status endpoint from a `<meta http-equiv="refresh">` page while analysis runs in the background

Return an interim HTML page that redirects itself after a delay, while a
background process persists the source and runs the rules, so a genuine
multi-request "loading" state can be shown.

- **Pros**: Produces a page that visibly changes between loading and done
  without JavaScript.
- **Cons**: Requires persisting the submitted source (or the in-progress
  run) somewhere queryable by a second request — directly contradicting
  "submitted source is not persisted by default". `AnalyzeSubject` runs
  in-process against in-memory rules with no I/O of its own; there is no
  slow step here to hide behind a redirect. Manufacturing one to justify a
  UI treatment the actual latency does not need is solving a problem this
  system does not have.

### Option 3: A single POST handler that renders results synchronously, and separately appends `AnalyzeSubject`'s events to an injected `EventStore`, replayable through a new query-side projection

Same request/response shape as Option 1, plus: after `execute` returns,
the handler appends `run.events` to an `EventStore` under `run.analysisId`
(facts only — no source, per the event payloads' existing shape), and the
core package gains an `AnalysisRunProjection` (`Projection<AnalysisRunView>`,
ADR-0012's query side) that folds that stream back into a summary: which
rules completed with what status, which failed and why, and whether the
run is done. The "loading state" is the ordinary browser affordance for a
synchronous POST — a page load, not a client-rendered spinner — stated
explicitly rather than left implicit.

- **Pros**: Resolves ADR-0014's deferred risk with an actual test:
  `AnalyzeSubject.execute` → `EventStore.append` → `EventStore.read` →
  `AnalysisRunProjection` round-trips through a real in-memory store, not a
  hand-built envelope. Keeps "no persistence of source" literally true —
  the event payloads this projection folds were already minimized before
  this issue existed. Costs nothing in the browser: still zero client JS,
  still one request per analysis.
- **Cons**: The read model this projection produces is not what the page
  renders to the user (the page renders `results` directly, which is
  richer) — so, today, nothing calls `AnalysisRunProjection` outside of a
  test proving replay works. It exists to make a documented architectural
  claim true, not to serve a current request. A future consumer (e.g. "look
  up a past run", out of scope here) is what would actually read it.
- **Cons**: `EventStore` is wired at the composition root as
  `InMemoryEventStore`, which does not survive a Lambda cold start. This is
  the same category of gap already called out for `InMemoryPrincipleCatalog`
  and `InMemoryRuleCatalog`: the port is real and correctly shaped, the
  concrete adapter is not yet durable. A durable event store is
  infrastructure work this issue does not do.

## Decision

Use **Option 3**.

- `POST /analyze` parses a form submission (`multipart/form-data`, so a
  single `<input type="file">` — no `multiple` — can be read server-side
  without JavaScript) containing either an uploaded file or pasted text in
  a `<textarea>`, plus a language. Exactly one of the two source fields is
  used per request (the file, if present and non-empty; otherwise the
  pasted text), which is what keeps "exactly one file" true by construction
  rather than by validation.
- The handler builds a `Subject`; a validation failure (empty source, empty
  language) re-renders the same page in an error state, echoing the user's
  input back into the form rather than discarding it.
- A valid `Subject` is passed to `AnalyzeSubject.execute({ subject })` —
  every rule in the composition root's `RuleCatalog` runs; there is no rule
  picker in this UI, since the SOLID rules (#10-#14) do not exist yet and a
  catalog of zero rules would make one meaningless. The response renders
  every `AnalysisResult` in `results`: status, confidence, method,
  explanation, evidence (excerpt + location, when the rule provided any),
  remediation and limitations when present.
- The run's `events` are appended to an injected `EventStore` under
  `run.analysisId` immediately after `execute` returns, purely to keep
  ADR-0014's replay claim true; the response does not wait on or depend on
  this succeeding differently than it already doesn't depend on
  instrumentation.
- No "loading" affordance beyond the browser's own page-load feedback is
  built. This is stated as the decision, not left as a gap: there is no
  slow step in this workflow to justify one, and ADR-0004 already ruled out
  the client-side alternative.

## Consequences

### Positive

- A pasted or uploaded single file gets a real, structured findings page —
  status, confidence, method, explanation, evidence and locations — with
  zero client-side JavaScript, satisfying #34's acceptance criteria as
  literally as ADR-0004 already required for every other page.
- ADR-0014's "nothing yet appends `AnalysisRun.events` anywhere" risk is
  closed by a passing end-to-end test: `AnalyzeSubject` → real
  `InMemoryEventStore` → `AnalysisRunProjection`, replaying a run's status
  per rule from its event stream alone.
- The file-or-textarea choice needs no explicit "pick one" UI or validation
  branch beyond "prefer the file if given" — the HTML `<input>` without
  `multiple` already enforces "at most one file" for free.
- Findings are rendered from `AnalyzeSubject`'s synchronous `results`, so
  the page never has to wait on, or be built around, the eventually-durable
  event store — a slow or unavailable store degrades replayability, not the
  feature the user is looking at.

### Negative

- `AnalysisRunProjection` has exactly one caller today, and it is a test.
  It exists to keep a documented architectural property (replay) true, at
  the cost of shipping a read model nothing in the product queries yet.
- The event store wired at the composition root is `InMemoryEventStore`,
  which loses every run's history on the next Lambda cold start. The
  "replay" claim is proven against the port, not against durable
  production infrastructure — the same gap already accepted for the rule
  and principle catalogs.
- There is no rule picker: every request runs every rule in the catalog,
  which is zero rules until #10-#14 land. Until then, every analysis
  legitimately returns no findings — a correct but unhelpful first
  experience, and one this issue leaves as-is rather than fabricating a
  demo rule to look more finished than the system is.

### Risks and mitigations

- *Risk*: A future contributor reads "findings show source locations" and
  assumes the web UI supports multi-file navigation. *Mitigation*:
  `SourceLocation.filePath` is left `undefined` for web submissions (it is
  documented as optional specifically for this case), and the page never
  renders cross-file claims, matching #34's acceptance criteria directly.
- *Risk*: Treating "the browser's own page-load feedback" as the loading
  state could be mistaken for an oversight rather than a decision.
  *Mitigation*: recorded here explicitly, with the option that would have
  built a fake one, and why it was rejected.
- *Risk*: A durable `EventStore` adapter, once built, might not match the
  shape `InMemoryEventStore` already satisfies. *Mitigation*: accepted as
  the same risk already carried by every other in-memory adapter in this
  codebase; the port (`EventStore`) is the contract a durable adapter has
  to satisfy, not `InMemoryEventStore` itself.

## Related

- ADR-0004 — no client-side JavaScript; the constraint this ADR's "loading
  state" decision has to satisfy.
- ADR-0012 — the `EventStore`/`Projection`/`Projector` machinery this ADR's
  `AnalysisRunProjection` is the first concrete instance of.
- ADR-0013 — the `AnalysisResult` contract rendered on the results page,
  and the evidence-minimization requirement that keeps its event payloads
  smaller than the result itself.
- ADR-0014 — the engine this ADR is the first caller of, including the
  replay risk this ADR closes with a passing test.
- #28 — the compliance baseline requiring evidence minimization and "no
  persistence of source by default", both of which this ADR's event-only
  persistence choice is built to satisfy.
