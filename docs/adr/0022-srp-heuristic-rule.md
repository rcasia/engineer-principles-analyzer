# ADR-0022: Detect Single Responsibility violations with a dependency-free method-name heuristic

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #10 asks for a rule that flags potential Single Responsibility
Principle violations: classes with multiple unrelated responsibilities,
excessive responsibility concentration, and poor separation of concerns —
reported as structured findings with evidence, with strong findings
distinguished from uncertain cases, and without assuming one OO style fits
every language.

The rule runs inside the engine built in ADR-0014, returns the
`AnalysisResult` contract from ADR-0013, and must satisfy the compliance
baseline (#28): findings attributable to code evidence, no person-level
profiles, and confidence/uncertainty semantics with human-review framing.
It also has to fit the CLI's distribution model: `packages/cli` is bundled
for Node with no runtime dependencies (ADR-0008), and `core` ships none —
so the rule cannot depend on a real parser (TypeScript compiler API,
Babel, tree-sitter) even though a parser is the "proper" way to find class
boundaries.

## Decision Drivers

- **Zero runtime dependencies.** Anything the rule imports ships in the
  `principled` npm tarball (ADR-0008). A parser dependency is not just
  weight — it is a supply-chain and audit surface (`bun run audit`,
  ADR-0011) for every future language.
- **No OO-style imperialism.** #10 explicitly requires not assuming one OO
  style is correct for every language. A rule that reports `compliant` for
  Python because it found no classes would be making exactly that claim.
- **Honest uncertainty over false precision.** A heuristic that cannot tell
  will be wrong in public, on other people's code. The contract already has
  `uncertain`, `not_applicable`, confidence, limitations and
  `humanReviewRecommended` (ADR-0013) — the rule should use all of them
  rather than forcing every input into violation/compliant.
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).

## Considered Options

### Option 1: Depend on a real parser per language (TS compiler API, tree-sitter)

Precise class/method boundaries, no regex fragility, full type information
for deeper cohesion signals (shared state between methods, call graphs).

- **Pros**: Correct boundaries; opens the door to real cohesion metrics
  (LCOM-style) later.
- **Cons**: A heavyweight dependency in the published bundle against
  ADR-0008's explicit "no runtime dependencies" constraint; one parser per
  language multiplies the audit surface (ADR-0011); still does not solve
  the actual judgment (which responsibilities are "unrelated" remains a
  naming/semantic question no AST can answer).

### Option 2: A dependency-free text scanner plus a fixed method-name responsibility dictionary (chosen)

Find class-shaped constructs and their top-level methods with a small
hand-written scanner (string/template/comment-aware brace matching, no
regex for structure), then group method names into responsibility domains
(persistence, communication, presentation, validation, calculation,
authentication, serialization, logging) via a fixed keyword dictionary.
Three or more domains at ≥2 methods each is a `violation`; exactly two is
`uncertain`; one or zero is `compliant`; fewer than 3 methods total is
`uncertain` (too little signal either way); unsupported languages and
subjects with no class construct are `not_applicable` — never `compliant`.

- **Pros**: Zero dependencies, keeping ADR-0008 intact; the scanner is
  ~120 lines and fully mutation-tested; the verdict degrades gracefully
  (`uncertain`/`not_applicable`) instead of guessing; the dictionary is a
  plain data table that can grow (recall improvements) without changing the
  rule's contract.
- **Cons**: Heuristic twice over — the scanner misses unusual formatting,
  arrow-function class fields and nested-paren decorators, and the
  dictionary only knows the words it knows (a different natural language or
  house style under-reports). Method-name clustering is a proxy for
  responsibility, not a measurement of it. Recall is deliberately traded
  for precision and honesty about uncertainty.

### Option 3: AI-assisted judgment per subject

Send the subject to a language model and report its verdict as
`ai_assisted`.

- **Pros**: Best understanding of what a class "does".
- **Cons**: Requires a model provider at analysis time (privacy/data-flow
  review per #28, latency, cost), verdicts are non-deterministic (harder to
  mutation-test and to reproduce in evaluation snapshots, #30), and the
  "never present AI findings as deterministic facts" requirement becomes a
  per-result burden rather than a structural property. Premature before the
  deterministic/heuristic baseline exists to compare against.

## Decision

Use **Option 2**, structured as pure domain functions plus one thin
`Rule` adapter:

```
packages/core/src/principles/srp/
  domain/
    source-scanner.ts         string/template/comment-aware brace matching
    class-declaration.ts      class Name { ... } extraction
    class-members.ts          top-level method-name extraction
    responsibility-domain.ts  fixed keyword dictionary + MINIMUM_METHODS_PER_DOMAIN
    class-assessment.ts       method-count floor + domain-count verdict thresholds
    supported-language.ts     explicit allow-list (typescript, javascript)
  infrastructure/
    srp-rule.ts               SrpRule (id "solid.srp") -> AnalysisResult
```

`SrpRule` reports one `AnalysisResult` per subject (worst class verdict
wins; evidence attached only for the classes behind that verdict), always
with `method: "heuristic"` (or `"deterministic"` for the `not_applicable`
scope facts), calibrated sub-1.0 confidence, the three known limitations
disclosed verbatim, and `humanReviewRecommended` on everything but
`compliant`. Analyzer identity is `principled-solid-srp` version `1`, so
evaluation snapshots (#30) can attribute results to this exact
implementation. `SrpRule` is exported from `@principled/core` and
registered in the web composition roots (`bin.ts`, `lambda-entry.ts`); the
CLI gains nothing because it has no analysis command yet (#18 owns that).

## Consequences

### Positive

- #10's acceptance criteria are met structurally: structured findings with
  line evidence; strong (`violation`) vs uncertain (`uncertain`,
  `not_applicable`) kept apart by status, not prose; no OO judgment passed
  on languages outside the allow-list.
- #28's rule-level obligations fall out of the design: evidence excerpts
  are minimal (`class Foo { … }`, never whole files); nothing person-level
  is computed (the rule sees source and language only); uncertainty and
  human-review framing are mandatory fields, not documentation.
- 97.57% mutation score on the new slice (528 killed + 33 timeouts of 575;
  the 14 survivors were each analysed and are equivalent mutants — loop
  `<=` no-op iterations, ternary/`&&` interlocks, regex
  backtracking-equivalents — not missing tests).
- #11–#14 get a worked pattern: pure domain functions + thin adapter +
  exact-string tests + disclosed limitations, all without new dependencies.

### Negative

- Recall is knowingly limited: non-English names, unconventional verbs,
  responsibilities expressed through composition rather than method names,
  and multi-function modules in non-class styles are all missed. The rule
  understates concentration more often than it overstates it.
- The keyword dictionary is English-centric; every keyword is currently
  only exercised (and therefore only protected) in English.
- Thresholds (3 methods, 2 methods/domain, 2/3 domains) are reasoned
  choices, not measured ones — tuning them against the corpus (#27) may
  move them, which is a rule-version bump, not a contract change.

### Risks and mitigations

- *Risk*: Users read a `violation` as a deterministic fact rather than a
  method-name heuristic. *Mitigation*: `method: "heuristic"`, confidence
  0.55, mandatory limitations and human-review flag travel with every
  verdict; the web UI already renders all four (ADR-0015's findings view).
- *Risk*: The fixed dictionary drifts from how real code is named and
  recall silently rots. *Mitigation*: rule-level precision/recall/FPR/FNR
  against the versioned corpus (#27, #30) is the defined feedback loop;
  dictionary growth never changes the contract.
- *Risk*: A future rule copies the scanner instead of sharing it.
  *Mitigation*: the scanner is exported within the slice for sibling SOLID
  rules to reuse; deduplication across #11–#14 is expected follow-up, not
  premature abstraction today.

## Related

- #10 (this rule), #11–#14 (sibling SOLID rules, same pattern).
- ADR-0008 (no runtime dependencies — why there is no parser),
  ADR-0013 (the result contract this rule returns),
  ADR-0014 (the engine that runs it).
- #27 (evaluation corpus — where thresholds get measured),
  #28 (compliance baseline — evidence/human-review obligations),
  #30 (versioned evaluation snapshots — analyzer name/version exists for this).
