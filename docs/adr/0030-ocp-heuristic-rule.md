# ADR-0030: Detect Open/Closed violations with a dependency-free branch-counting heuristic

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #11 asks for a rule that flags potential Open/Closed Principle
violations: repeated branching, switch/if chains, type-based dispatch, and
missing extension points — reported as structured findings with evidence,
with uncertainty preserved, and reasoned per language.

The rule runs inside the engine built in ADR-0014, returns the
`AnalysisResult` contract from ADR-0013, and must satisfy the compliance
baseline (#28) like its SRP sibling (ADR-0022): findings attributable to
code evidence, no person-level profiles, and confidence/uncertainty
semantics with human-review framing. It also has to fit the CLI's
distribution model: `packages/cli` is bundled for Node with no runtime
dependencies (ADR-0008), and `core` ships none — so the rule cannot depend
on a real parser even though a parser is the "proper" way to find branch
boundaries.

## Decision Drivers

- **Zero runtime dependencies.** Anything the rule imports ships in the
  `principled` npm tarball (ADR-0008).
- **Honest uncertainty over false precision.** Not every `switch` is a
  violation: a closed set of cases (days of the week, an exhaustive state
  machine) branches without asking to be extended. The contract already has
  `uncertain`, confidence, limitations and `humanReviewRecommended`
  (ADR-0013) — the rule should use them rather than condemn every branch.
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).
- **Same slice pattern as SRP** (ADR-0022): pure domain functions plus one
  thin `Rule` adapter, exact-string tests, disclosed limitations.

## Considered Options

### Option 1: Depend on a real parser per language

Precise branch locations, no regex fragility, control-flow graphs for
deeper "should this have been polymorphism" signals.

- **Pros**: Correct boundaries; opens the door to real extension-point
  detection (existing polymorphism, registries) later.
- **Cons**: A heavyweight dependency in the published bundle against
  ADR-0008's explicit "no runtime dependencies" constraint; one parser per
  language multiplies the audit surface (ADR-0011); still does not solve
  the actual judgment (whether a branch set is closed remains a semantic
  question no AST can answer).

### Option 2: A dependency-free noise-stripping scanner plus fixed signal thresholds (chosen)

Blank strings, template literals and comments (keeping newlines so line
numbers still line up), then count `switch` statements, `else if` chains
and `typeof`/`instanceof` type guards with word-boundary patterns. Three
or more signals is a `violation`; exactly two is `uncertain`; one or zero
is `compliant`; unsupported languages are `not_applicable` — never
`compliant`.

- **Pros**: Zero dependencies, keeping ADR-0008 intact; the scanner is a
  small state machine fully covered by exact-string tests; the verdict
  degrades gracefully (`uncertain`/`not_applicable`) instead of guessing;
  thresholds are exported constants the corpus (#27) can measure.
- **Cons**: Heuristic twice over — the counter cannot tell a closed case
  list from a type-dispatch chain (disclosed as a limitation, not hidden),
  and it cannot see extension points already in place (polymorphism,
  registries, plugin hooks). Recall of "already well-factored" is
  deliberately traded for precision on "edits existing branches".

### Option 3: AI-assisted judgment per subject

Send the subject to a language model and report its verdict as
`ai_assisted`.

- **Pros**: Best understanding of whether a branch set is really closed.
- **Cons**: Requires a model provider at analysis time (privacy/data-flow
  review per #28, latency, cost), verdicts are non-deterministic (harder
  to mutation-test and to reproduce in evaluation snapshots, #30).
  Premature before the deterministic/heuristic baseline exists to compare
  against — the same deferral ADR-0022 already made for SRP.

## Decision

Use **Option 2**, structured as pure domain functions plus one thin
`Rule` adapter:

```
packages/core/src/principles/ocp/
  domain/
    supported-language.ts  explicit allow-list (typescript, javascript)
    branch-signals.ts      noise stripping + switch/else-if/type-guard counts
                           + first-signal locator
    ocp-assessment.ts      signal-count verdict thresholds (3/2)
  infrastructure/
    ocp-rule.ts            OcpRule (id "solid.ocp") -> AnalysisResult
```

`OcpRule` reports one `AnalysisResult` per subject with the first signal's
line as evidence (whenever at least one signal exists), always with
`method: "heuristic"` (or `"deterministic"` for the `not_applicable` scope
fact), calibrated sub-1.0 confidence (0.55 violation / 0.4 uncertain /
0.65 compliant, mirroring SRP), the three known limitations disclosed
verbatim, and `humanReviewRecommended` on everything but `compliant`.
Analyzer identity is `principled-solid-ocp` version `1`, so evaluation
snapshots (#30) can attribute results to this exact implementation.
`OcpRule` is exported from `@principled/core` and registered in the web
composition roots (`bin.ts`, `lambda-entry.ts`); the CLI gains nothing
because it has no analysis command yet (#18 owns that).

## Consequences

### Positive

- #11's acceptance criteria are met structurally: structured findings with
  line evidence; strong (`violation`) vs uncertain (`uncertain`,
  `not_applicable`) kept apart by status, not prose; language-appropriate
  reasoning via the explicit allow-list (no branching judgment passed on
  languages whose shape this rule does not know).
- #28's rule-level obligations fall out of the design: evidence excerpts
  are a single trimmed line, never whole files; nothing person-level is
  computed (the rule sees source and language only); uncertainty and
  human-review framing are mandatory fields, not documentation.
- #12–#14 get a second worked pattern next to ADR-0022's: counting
  heuristics over noise-stripped source, with the same confidence scale
  and the same worst-verdict-free single-assessment shape where one
  verdict per subject suffices.

### Negative

- Precision risk is structural: closed case lists are reported exactly
  like type-dispatch chains. The limitation is disclosed on every verdict,
  but a user in a hurry will still read a `violation` as "you did it
  wrong" rather than "three branches deserve a second look".
- Thresholds (3/2 signals) are reasoned choices, not measured ones —
  tuning them against the corpus (#27) may move them, which is a
  rule-version bump, not a contract change.
- The noise stripper blanks whole template literals including
  `${interpolations}`, so a branch inside an interpolation is missed. The
  stripper is tested for this behaviour on purpose (documented gap, not a
  silent one).

### Risks and mitigations

- *Risk*: Users read a `violation` as a deterministic fact rather than a
  branch-counting heuristic. *Mitigation*: `method: "heuristic"`,
  confidence 0.55, mandatory limitations and human-review flag travel with
  every verdict; the web UI already renders all four (ADR-0015's findings
  view).
- *Risk*: Thresholds rot silently as code styles shift. *Mitigation*:
  rule-level precision/recall/FPR/FNR against the versioned corpus (#27,
  #30) is the defined feedback loop; retuning is a rule-version bump.
- *Risk*: A future rule copies the noise stripper instead of sharing it.
  *Mitigation*: same accepted follow-up as ADR-0022's scanner —
  deduplication across #11–#14 once the shapes settle, not premature
  abstraction today.

## Related

- #11 (this rule), #12–#14 (sibling SOLID rules, same pattern).
- ADR-0008 (no runtime dependencies — why there is no parser),
  ADR-0013 (the result contract this rule returns),
  ADR-0014 (the engine that runs it), ADR-0022 (the sibling pattern).
- #27 (evaluation corpus — where thresholds get measured),
  #28 (compliance baseline — evidence/human-review obligations),
  #30 (versioned evaluation snapshots — analyzer name/version exists for this).
