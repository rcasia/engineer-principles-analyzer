# ADR-0036: Judge the SOLID rules against a versioned synthetic corpus

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #27 asks for a test corpus for SOLID judgments: the foundation
for every public quality claim, tracking per rule and language
precision, recall, false-positive/false-negative rates, confidence
calibration and evidence coverage against versioned evaluation
snapshots — never against live user traffic, and never with private
customer code in a public benchmark.

Since the SOLID stories landed, sibling work has built half of this:
`evaluation/domain/rule-quality.ts` derives precision/recall/FPR/FNR
from confusion counts, and `evaluation/domain/evaluation-snapshot.ts`
(#30) publishes versioned, dated snapshots with per-rule-per-language
rows carrying calibration, evidence coverage and sample size. What does
not exist yet is the corpus itself — the fixtures — and the harness
that runs the real rules against them through the real engine.

## Decision Drivers

- **Reuse, not a second harness.** The confusion-count and snapshot
  machinery already exists and is mutation-tested. A corpus harness
  that re-derives rates by hand would duplicate exactly the logic #30
  owns.
- **Fixtures must be synthetic by construction.** #28 forbids private
  customer submissions in public benchmarks without explicit
  authorization. The cheapest airtight enforcement is provenance: every
  v1 fixture is hand-written for the corpus file, so there is nothing
  to leak.
- **Binary and clear-cut.** The v1 heuristics report honest
  `uncertain`/`not_applicable` on ambiguous input — that is their
  compliance mechanism, not corpus material. A fixture the rules cannot
  decide is a bad fixture, not a passing test.
- **The corpus pins behaviour.** If a rule change moves a fixture
  across the violation/compliant line, the corpus test must fail until
  the corpus version bumps with a dated note — otherwise evaluation
  numbers drift without anyone noticing.
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).

## Considered Options

### Option 1: Fixtures plus an ad-hoc script outside core

Keep the fixtures as JSON and score them with a one-off script.

- **Pros**: No new production surface; fastest to write.
- **Cons**: A script outside the package cannot reuse the engine and
  the snapshot validator without awkward imports, is not
  mutation-tested, and gives #30 nothing to call — every future
  snapshot would re-solve "how to run the corpus".

### Option 2: A validated corpus plus an engine-driven harness in core (chosen)

`evaluation/domain/corpus-entry.ts` defines `CorpusEntry` (binary
`violation`/`compliant` expectation) and `validateCorpus`, which fails
loudly on an empty corpus, a blank field, a non-binary expectation, or
a duplicated id. `evaluation/corpus/solid-corpus-v1.ts` holds twenty
synthetic TypeScript fixtures — four per SOLID rule, two violations and
two compliant — with `SOLID_CORPUS_VERSION = "1"`.
`evaluation/application/evaluate-corpus.use-case.ts` (`EvaluateCorpus`)
runs each entry through `AnalyzeSubject` with the real rules, maps
(expected, actual) to confusion counts (any non-matching actual status,
`uncertain` included, counts as a miss), and summarizes per
(ruleId, language) with `summarizeRuleQuality`, mean confidence,
`|mean − precision|` calibration gap, evidence coverage and sample
size. The corpus test asserts perfect precision/recall per rule plus a
`publishSnapshot` round-trip, so #27 and #30 are proven integrated,
not merely adjacent.

- **Pros**: Reuses the engine (#9), the result contract (#8), the
  quality math and the snapshot validator (#30) — the only new logic
  is fixtures plus the expected/actual mapping, both directly tested.
  The perfect-score assertion is the behaviour pin: any rule retune
  that moves a fixture fails loudly until the corpus version bumps.
  Core-only means CLI/web parity is preserved trivially — both adapters
  can drive the same harness later with no per-adapter work.
- **Cons**: Twenty fixtures pin v1 thresholds in test form, so tuning
  a threshold (the defined follow-up in ADR-0022/0030/0032/0034/0035)
  now requires touching the corpus file too — intended friction, but
  friction. TypeScript-only for v1, so per-language reporting is proven
  structurally but populated for one language.

### Option 3: Harvest real-world fixtures now

Mine public repositories for positive/negative cases per rule.

- **Pros**: Realistic naming and structure; harder to overfit the
  heuristics to hand-written fixtures.
- **Cons**: Provenance review per fixture, licensing checks, and
  labelling effort this issue cannot fund — and a v1 corpus that mixes
  harvested code with synthetic fixtures cannot make the clean
  "synthetic by construction" claim. Deferred: harvested corpora are a
  later corpus version, not v1.

## Decision

Use **Option 2**. v1 is twenty synthetic TypeScript fixtures, an
engine-driven harness reusing #30's math, and a corpus test that pins
perfect per-rule scores plus snapshot publishability. Corpus changes
bump `SOLID_CORPUS_VERSION` with a dated file-history note; rule
retunes that move a fixture bump both the rule version and the corpus
version together.

## Consequences

### Positive

- #27's acceptance criteria are met structurally: implemented (fixtures
  + validation + harness, all exported from `@principled/core`),
  documented (this ADR plus per-fixture notes), covered by tests
  (validation boundaries, harness mapping with stub rules, the
  full-corpus gate), reusing the shared analysis model (real engine,
  real rules, #30's quality math and snapshot validator, zero
  duplicated rule logic), and core-only so web/CLI parity holds by
  construction.
- The per-rule evidence-coverage numbers pin each rule's evidence
  policy in measurable form (SRP/ISP 1.0, OCP 0.75, LSP/DIP 0.5) —
  changing a rule's evidence policy now moves a corpus number, which is
  exactly the feedback loop the rule ADRs promised.
- #30 can publish the v1 snapshot today: the corpus test already builds
  one through `publishSnapshot`.

### Negative

- Hand-written fixtures risk overfitting: the heuristics score 1.0 on
  fixtures written by the same author who wrote the heuristics. The
  corpus measures self-consistency, not real-world accuracy — the
  limitations say so, and harvested corpora are the defined next step.
- Perfect-score pinning makes threshold tuning a two-file change (rule
  + corpus version bump). Deliberate, but slower than tuning the rule
  alone.
- TypeScript-only v1: JavaScript support in every rule's allow-list is
  unevaluated, and the SRP Java/Python extractors (ADR-0031) have no
  corpus coverage at all.

### Risks and mitigations

- *Risk*: The 1.0 scores get quoted as real-world accuracy.
  *Mitigation*: the corpus file header, the snapshot methodology, and
  the limitations all state "synthetic clear-cut cases"; snapshots
  carry sample size (4 per rule) so no reader can mistake v1 for a
  large study.
- *Risk*: A future contributor "fixes" a red corpus gate by editing
  fixtures to match a regressed rule instead of bumping the version
  honestly. *Mitigation*: `validateCorpus` cannot catch dishonest
  edits — review must. The version-bump protocol is stated here so
  reviewers know what to demand.
- *Risk*: Fixture source accidently includes customer code.
  *Mitigation*: provenance by construction (hand-written here) plus
  review; `publishSnapshot`'s #28 telemetry guard stands behind the
  snapshot step.

## Related

- #27 (this corpus), #30 (snapshots — the consumer of these numbers),
  #28 (why every fixture is synthetic).
- ADR-0013 (the result contract the harness reads),
  ADR-0014 (the engine the harness drives),
  ADR-0022/0030/0032/0034/0035 (the five rules under judgment,
  whose thresholds and evidence policies this corpus pins).
- #10–#14 (the judged stories), #47 (the feature they complete).
