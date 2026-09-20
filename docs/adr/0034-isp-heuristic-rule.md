# ADR-0034: Detect Interface Segregation violations with a dependency-free member-count heuristic

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #13 asks for a rule that flags potential Interface Segregation
Principle violations: broad interfaces, unrelated operations,
consumer-specific interfaces, unused methods, and dependency
relationships — working for interface/protocol/trait-like abstractions
where appropriate, and distinguishing genuine coupling from normal
language constructs.

The rule runs inside the engine built in ADR-0014, returns the
`AnalysisResult` contract from ADR-0013, and must satisfy the compliance
baseline (#28) like its siblings (ADR-0022, ADR-0030, ADR-0032):
findings attributable to code evidence, no person-level profiles, and
confidence/uncertainty semantics with human-review framing. It also has
to fit the CLI's distribution model: `packages/cli` is bundled for Node
with no runtime dependencies (ADR-0008), and `core` ships none — so the
rule cannot depend on a real parser even though a parser is the "proper"
way to resolve interface members and their consumers.

## Decision Drivers

- **Zero runtime dependencies.** Anything the rule imports ships in the
  `principled` npm tarball (ADR-0008).
- **Honest uncertainty over false precision.** Member count is breadth,
  not proof of unrelatedness: a large but cohesive interface is not the
  same finding as unrelated operations forced on one client, and a rule
  that cannot see any client must say so rather than condemn size alone.
- **Clients are invisible in a single subject.** Whether anyone actually
  suffers unused members cannot be answered from one file's text. The
  rule must frame its verdict as "worth a look", not "clients harmed".
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).
- **Same slice pattern as SRP/OCP/LSP** (ADR-0022, ADR-0030, ADR-0032):
  pure domain functions plus one thin `Rule` adapter, exact-string
  tests, disclosed limitations.

## Considered Options

### Option 1: Depend on a real parser plus cross-file client analysis

Precise member lists (including inherited and mapped members) joined
against actual consumers to prove which members go unused per client.

- **Pros**: Genuine ISP evidence — unused-per-client members — instead of
  a size proxy; resolves the "cohesive but large" false positive.
- **Cons**: A heavyweight dependency in the published bundle against
  ADR-0008's explicit "no runtime dependencies" constraint; requires
  multi-file project analysis (#22), which does not exist yet — this
  rule's input is one subject, by engine design (ADR-0014).

### Option 2: A dependency-free interface scanner plus fixed member-count thresholds (chosen)

Find `interface Name { ... }` declarations and `type Name = { ... }`
object literals with a small hand-written scanner, count top-level
members textually (fragments split on `;` or a newline at brace depth
zero, strings and comments skipped). Seven or more members is a
`violation`; five or six is `uncertain`; four or fewer is `compliant`;
no interface-shaped construct at all is `not_applicable` — never
`compliant`.

- **Pros**: Zero dependencies, keeping ADR-0008 intact; covers both
  TypeScript interface idioms (declared interfaces and object type
  literals); the verdict degrades gracefully (`uncertain`/
  `not_applicable`) instead of guessing; thresholds are exported
  constants the corpus (#27) can measure.
- **Cons**: Size is not segregation — a cohesive seven-method interface
  is reported exactly like seven unrelated operations (disclosed as a
  limitation, not hidden), and no verdict can name a suffering client
  because no client is visible. Recall of "actually harmful" is
  deliberately traded for precision on "broad enough to inspect".

### Option 3: AI-assisted judgment per subject

Send the subject to a language model and report its verdict as
`ai_assisted`.

- **Pros**: Best understanding of whether members are truly unrelated
  and whether a split would help any consumer.
- **Cons**: Requires a model provider at analysis time (privacy/data-flow
  review per #28, latency, cost), verdicts are non-deterministic (harder
  to mutation-test and to reproduce in evaluation snapshots, #30).
  Premature before the deterministic/heuristic baseline exists to compare
  against — the same deferral ADR-0022 already made for SRP.

## Decision

Use **Option 2**, structured as pure domain functions plus one thin
`Rule` adapter:

```
packages/core/src/principles/isp/
  domain/
    supported-language.ts    explicit allow-list (typescript, javascript)
    interface-declaration.ts interface + object-type extraction,
                             brace-depth-aware member counting
    isp-assessment.ts        member-count verdict thresholds (7/5),
                             worst-verdict-wins across interfaces
  infrastructure/
    isp-rule.ts              IspRule (id "solid.isp") -> AnalysisResult
```

`IspRule` reports one `AnalysisResult` per subject with declaration-line
evidence only for the interfaces behind a violation/uncertain verdict
(a compliant file's narrow interfaces are still listed, broadest
member-count included, so the verdict is checkable), always with
`method: "heuristic"` (or `"deterministic"` for the `not_applicable`
scope facts), calibrated sub-1.0 confidence (0.55 violation / 0.4
uncertain / 0.65 compliant, mirroring SRP/OCP/LSP), the three known
limitations disclosed verbatim, and `humanReviewRecommended` on
everything but `compliant`. Analyzer identity is
`principled-solid-isp` version `1`, so evaluation snapshots (#30) can
attribute results to this exact implementation. `IspRule` is exported
from `@principled/core` and registered in the web composition roots
(`bin.ts`, `lambda-entry.ts`); the CLI gains nothing because it has no
analysis command yet (#18 owns that).

## Consequences

### Positive

- #13's acceptance criteria are met structurally: structured findings
  with line evidence; strong (`violation`) vs uncertain (`uncertain`,
  `not_applicable`) kept apart by status, not prose; both TypeScript
  interface idioms read without mistaking ordinary functions or classes
  for interfaces (genuine coupling vs normal constructs).
- #28's rule-level obligations fall out of the design: evidence excerpts
  are minimal (`interface God { … }`, never whole files); nothing
  person-level is computed (the rule sees source and language only);
  uncertainty and human-review framing are mandatory fields, not
  documentation.
- #14 gets a fourth worked pattern next to ADR-0022's, ADR-0030's and
  ADR-0032's, with the same confidence scale and the same
  worst-verdict-wins shape where one verdict per subject must summarise
  several constructs.

### Negative

- Precision risk is structural: cohesive-but-large interfaces are
  reported exactly like unrelated-operation groupings. The limitation is
  disclosed on every verdict, but a user in a hurry will still read a
  `violation` as "split this" rather than "seven members deserve a
  second look".
- The textual member count over-counts signatures broken across lines
  without semicolons and cannot see inherited members at all — an
  interface that is fat through `extends` reads narrow. Both gaps are
  disclosed; the second resolves only with project-level analysis (#22).
- Thresholds (7/5 members) are reasoned choices, not measured ones —
  tuning them against the corpus (#27) may move them, which is a
  rule-version bump, not a contract change.

### Risks and mitigations

- *Risk*: Users read a `violation` as proof clients are harmed rather
  than a breadth heuristic over a client-blind subject. *Mitigation*:
  `method: "heuristic"`, confidence 0.55, mandatory limitations
  (including "cannot see clients at all") and human-review flag travel
  with every verdict; the web UI already renders all four (ADR-0015's
  findings view).
- *Risk*: Thresholds rot silently as interface styles shift.
  *Mitigation*: rule-level precision/recall/FPR/FNR against the
  versioned corpus (#27, #30) is the defined feedback loop; retuning is
  a rule-version bump.
- *Risk*: A future rule copies the interface scanner instead of sharing
  it. *Mitigation*: same accepted follow-up as the sibling scanners —
  deduplication across #11–#14 once the shapes settle, not premature
  abstraction today.

## Related

- #13 (this rule), #14 (the remaining sibling SOLID rule).
- ADR-0008 (no runtime dependencies — why there is no parser),
  ADR-0013 (the result contract this rule returns),
  ADR-0014 (the engine that runs it),
  ADR-0022/ADR-0030/ADR-0032 (sibling patterns).
- #27 (evaluation corpus — where thresholds get measured),
  #28 (compliance baseline — evidence/human-review obligations),
  #30 (versioned evaluation snapshots — analyzer name/version exists for this).
