# ADR-0014: Build a fault-isolating rule evaluation engine, seeded with a fake ruleset

**Status**: Accepted
**Date**: 2026-09-19

## Context

The `AnalysisResult` contract (#8, ADR-0013) defines what one rule evaluation
returns. Nothing yet runs a rule, runs several of them for one subject, or
turns an independently-authored rule's crash into something the CLI or web
UI can still render. That is #9.

The actual SOLID detectors do not exist yet and are not this issue's job —
they are five separate, specialized stories (#10 SRP, #11 OCP, #12 LSP, #13
ISP, #14 DIP). Building the engine against real SOLID logic would couple a
generic capability to rules that have not been designed yet, and would make
it impossible to tell an engine bug from a rule bug while both are being
written for the first time. The engine has to be provably correct on its
own, against rules with **no real engineering judgment**, before any real
rule is written against it.

Three requirements from #9 shape the design specifically:

- **Fault isolation.** Rules are "independently executable" and the engine
  "can distinguish rule failures from uncertain judgments". A rule is not
  trusted code — ADR-0013 already flagged that "one rule's uncaught throw
  must not be able to take down the whole evaluation run" as a consequence
  of the contract, without building the thing that has to guarantee it.
- **Event sourcing (#33).** The engine "must emit events rather than
  persisting mutable analysis state directly", and must allow "analysis
  requests, completions and failures to be replayed", while staying
  "independent from the event-store adapter through ports."
- **No telemetry by default.** The metrics #9 lists (analysis latency, rule
  latency, rule failures, throughput, result-contract validity) are
  "engineering/evaluation metrics, not user analytics", and "the core engine
  must not emit telemetry by default."

## Decision Drivers

- **A crash in one rule must not lose every other rule's result.** This is
  the one property mutation testing (ADR-0003) has to be able to prove by
  actually crashing a fake rule, not by inspection.
- **"Uncertain" and "failed" cannot collapse into one bucket.** A rule that
  runs to completion and honestly reports it is not sure is doing its job;
  a rule that never produced a verdict did not. A caller (and a future
  evaluation framework, #30) needs to tell these apart without guessing from
  free-text.
- **No I/O the caller did not ask for.** No default telemetry sink, no
  default event-store append, no default rule catalog — mirroring the stub
  philosophy already accepted for `PrincipleCatalog` (ADR-0002).
- **Provable today, without the SOLID catalog.** The engine's own tests need
  rules to run, and those rules must not be mistaken for real principle
  detection later.

## Considered Options

### Option 1: A bare function, `runRules(rules, subject)`

Iterate the given rules, `await` each `evaluate`, return the array.

- **Pros**: minimal.
- **Cons**: one rejected promise fails `Promise.all` (or a thrown error goes
  uncaught) and the entire run is lost — the exact failure mode ADR-0013
  already named as unacceptable. No way to select a subset of rules, no
  distinction between a crash and an honest "uncertain", no event output, no
  instrumentation seam.

### Option 2: A `RuleCatalog` port and an `AnalyzeSubject` use-case, isolating and instrumenting every rule invocation, emitting events as data

Mirror the shape already established for principles (`PrincipleCatalog` +
`ListPrinciples`): a driven port for where rules come from, a driving
use-case that is the one entry point CLI/web will eventually call. Wrap each
rule's `evaluate` in a try/catch; treat a thrown error, a rejected promise,
or a value that is not actually an `AnalysisResult` instance the same way —
as an engine-level failure, synthesizing an `"unable_to_analyze"` result
attributed to the engine, not the rule. Produce `NewEvent` values (already
defined by the event-sourcing ports, ADR-0012) describing what happened, and
return them to the caller instead of appending them anywhere.

- **Pros**: A failing rule cannot affect any other rule's result — proven by
  mutation-tested tests that actually throw. The event shape
  (`AnalysisRequested` / `AnalysisCompleted` / `AnalysisFailed`) *is* the
  failure/uncertain distinction, not a side note: a rule that completes with
  `"uncertain"` produces `AnalysisCompleted`; a rule that never produced a
  verdict produces `AnalysisFailed`. Reuses the existing `EventStore`/
  `EventEnvelope` machinery without building a second one. Telemetry is
  fully optional (`EngineInstrumentation`, every hook optional, default a
  no-op object). The engine touches no adapter — no event store, no metrics
  backend — so `packages/cli` and `packages/web` really can share the exact
  same class.
- **Cons**: More surface than Option 1 for behaviour the SOLID rules have
  not exercised yet — the same "stub domain" cost ADR-0002 and ADR-0013
  already accepted, paid again here. `AnalyzeSubject` does not build or own
  a `Decider`/aggregate for the analysis stream; it only produces
  `NewEvent`s shaped for one. The aggregate that actually owns replay is
  left to #34, so "replay" is a design property today, not something this
  ADR can point at a passing test for.

### Option 3: A full event-sourced `Decider<AnalysisState, Command, Event>` for the run, per ADR-0012's pattern

Model the whole analysis run — request, per-rule completion, per-rule
failure — as a proper aggregate using the generic `Decider` interface
already in `eventsourcing/domain/decider.ts`, with `decide`/`evolve` and
rehydration.

- **Pros**: The strongest form of "the design must allow replay" — an actual
  aggregate that can be rehydrated, not just event-shaped data.
- **Cons**: `decide` must be pure and synchronous; running a rule is
  asynchronous and, per the fault-isolation driver, must catch failures at
  the moment they happen. Forcing that through a pure decider means either
  splitting "decide to start" and "record completion" into two separate
  commands the use-case round-trips through manually (most of the
  complexity of Option 2, plus an aggregate, for no additional behaviour
  this issue's acceptance criteria ask for), or making `decide` impure
  (breaking the contract every other decider in the codebase relies on).
  `eventsourcing/domain/decider.ts` already documents that building this
  aggregate is #34's job, once the web single-file workflow that will
  actually persist and query it exists to justify the shape.

## Decision

Use **Option 2**.

```
packages/core/src/engine/
  domain/
    subject.ts            Subject — sourceCode + language, the unit a rule
                           is evaluated against
    analysis-event.ts     AnalysisRequested / AnalysisCompleted / AnalysisFailed
                           payload shapes + event-type constants
  application/
    rule.port.ts           Rule — { id, evaluate(subject) } driven port
    rule-catalog.port.ts    RuleCatalog — where rules come from
    instrumentation.port.ts EngineInstrumentation — optional metrics hooks
    analyze-subject.use-case.ts   AnalyzeSubject — the engine itself
  infrastructure/
    in-memory-rule-catalog.ts     InMemoryRuleCatalog — ships empty, seeded
                                   by the caller, exactly like
                                   InMemoryPrincipleCatalog
```

`AnalyzeSubject.execute({ subject, ruleIds? })`:

1. Resolves rules from the injected `RuleCatalog` (or `undefined` per
   requested id it cannot find).
2. Runs every selected rule independently — a rejected or missing rule
   cannot prevent any other rule's result.
3. For each rule, `await`s `evaluate` inside a try/catch and additionally
   checks `outcome instanceof AnalysisResult`. Anything other than a
   genuine, contract-valid result — a throw, a rejection, a missing rule, or
   a malformed return value — is turned into the same shape: a synthesized
   `AnalysisResult` with `status: "unable_to_analyze"`, `analyzer` naming
   the engine (not the rule), and `limitations` saying plainly that this was
   not the rule's own judgment. This is the fault isolation: whatever went
   wrong, the caller still gets one well-formed result per requested rule.
4. Returns `{ analysisId, results, events }`. `results` is one
   `AnalysisResult` per requested rule, in request order. `events` is a
   `NewEvent<AnalysisEventPayload>[]`: one `AnalysisRequested`, plus one
   `AnalysisCompleted` (rule ran to completion, whatever it decided,
   `"uncertain"` included) or `AnalysisFailed` (the engine never got a
   verdict) per rule. `AnalyzeSubject` never calls `EventStore.append` — the
   caller decides whether and how to persist, keeping the core's "no
   persistence" and "independent from the event-store adapter" requirements
   literally true rather than merely intended.

Rule and analysis-run identifiers come from an injected `IdGenerator`
(`() => string`, default `crypto.randomUUID`), the same seam
`InMemoryEventStore`'s `Clock` already established for determinism under
test.

Metrics are an injected `EngineInstrumentation`, every method optional,
defaulting to an empty object — so `execute` never has anything to call
unless a composition root wires one in, keeping "no telemetry by default"
true by construction rather than by convention.

### The initial ruleset is fake, on purpose

The engine's own tests are the only ruleset this ADR ships: `Rule`
implementations with arbitrary, meaningless logic (e.g. "always compliant",
"always a violation", "always uncertain", "throws"), used exclusively inside
`analyze-subject.use-case.test.ts` and never exported from
`packages/core/src/index.ts`. They exist to prove the engine's own
properties — independent execution, fault isolation, the completed/failed
event split — without being mistaken for, or blocking on, the real SOLID
detectors #10–#14 are responsible for. `InMemoryRuleCatalog` ships with zero
rules by default, exactly like `InMemoryPrincipleCatalog`, so nothing
resembling this fake ruleset can reach a real caller by accident.

## Consequences

### Positive

- A rule crash, rejection, or contract-violating return value cannot affect
  any other rule's result — a fake rule that `throw`s is part of the test
  suite, not a hypothetical.
- The `AnalysisCompleted`/`AnalysisFailed` split makes "uncertain judgment"
  vs. "rule failure" a fact about which event exists, not a string a
  consumer has to parse.
- `AnalyzeSubject` imports no adapter — no event store, no metrics client —
  so the exact same class is what `packages/cli` and `packages/web` will
  both call once either wires it up (#17, #25).
- 100% mutation score on the new slice (93/93 mutants killed), including the
  timestamp-arithmetic and default-id-generator mutants that a looser
  ">= 0" assertion would have let survive.
- The fake ruleset gives #10–#14 a worked example of the `Rule` port's
  actual shape (including that a rule's own `ruleId` need not equal its
  catalog `id`) without asking them to inherit any of its logic.

### Negative

- More files than the behaviour justifies today — the same stub-domain cost
  ADR-0002 and ADR-0013 already accepted, paid a third time here, for an
  engine with no real rule to run yet.
- `AnalyzeSubject` produces events but does not append or replay them; the
  event-sourced aggregate that actually owns this stream is #34's job. Until
  that lands, "the design must allow replay" is a claim about shape
  compatibility with `EventStore`/`EventEnvelope`, not a passing end-to-end
  test.
- `RuleCatalog.all()` is trusted; a catalog implementation that itself
  throws is not caught by `AnalyzeSubject` the way a rule's `evaluate` is.
  Only rule execution is isolated, not rule discovery.
- The engine's synthesized failure result uses `method: "heuristic"` and
  `confidence: 0` for every failure mode (crash, missing rule, bad contract)
  — there is no way yet to tell these apart from `AnalysisResult` alone;
  only the paired `AnalysisFailed` event's `reason` field distinguishes
  them.

### Risks and mitigations

- *Risk*: A future contributor exports the fake ruleset, or copies its
  pattern into a real rule, mistaking "compiles against `Rule`" for "is a
  real detector". *Mitigation*: the fake rules live only in
  `analyze-subject.use-case.test.ts`, are never exported from `index.ts`,
  and this ADR states outright that #10–#14 owns the real ones.
  Consideration: enforced automatically is a follow-up, not built
  speculatively here.
- *Risk*: `RuleCatalog.all()` throwing is not isolated the way a rule is,
  so a bad catalog adapter can still fail an entire `execute` call.
  *Mitigation*: accepted for now — the in-memory adapter cannot throw, and a
  catalog backed by real I/O (a plugin directory, #24) is a future adapter
  that can add its own error handling without changing this contract.
- *Risk*: Nothing yet appends `AnalysisRun.events` anywhere, so the "must
  allow replay" requirement is unverified by an actual passing replay test.
  *Mitigation*: deliberately deferred to #34, which is where a real
  `EventStore` and a real caller both exist to write that test against.

## Related

- #8 / ADR-0013 — the `AnalysisResult` contract this engine composes.
- ADR-0012 — the `EventStore`/`EventEnvelope`/`Decider` machinery this
  engine's events are shaped to fit, without building the aggregate itself.
- #10, #11, #12, #13, #14 — the real SOLID rules this engine is deliberately
  built without.
- #34 — where a concrete event-sourced aggregate and actual persistence for
  an analysis run are expected to land.
