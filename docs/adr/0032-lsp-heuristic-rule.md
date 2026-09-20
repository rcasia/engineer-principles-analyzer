# ADR-0032: Detect Liskov violations with a dependency-free override-throw heuristic

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #12 asks for a rule that flags potential Liskov Substitution
Principle violations: strengthened preconditions, weakened
postconditions, unexpected exceptions, incompatible behaviour, incorrect
inheritance relationships, and implementations that contradict their
abstraction — without assuming inheritance is the only form of
substitutability.

The rule runs inside the engine built in ADR-0014, returns the
`AnalysisResult` contract from ADR-0013, and must satisfy the compliance
baseline (#28) like its siblings (ADR-0022, ADR-0030): findings
attributable to code evidence, no person-level profiles, and
confidence/uncertainty semantics with human-review framing. It also has
to fit the CLI's distribution model: `packages/cli` is bundled for Node
with no runtime dependencies (ADR-0008), and `core` ships none — so the
rule cannot depend on a real parser even though a parser is the "proper"
way to compare overrides against their parents.

## Decision Drivers

- **Zero runtime dependencies.** Anything the rule imports ships in the
  `principled` npm tarball (ADR-0008).
- **Honest uncertainty over false precision.** A subclass the rule cannot
  compare — because the parent lives outside the subject — must not be
  reported `compliant`. Absence of a local parent is a fact about scope,
  not evidence of substitutability.
- **One observable proxy, not five.** Strengthened preconditions and
  weakened postconditions cannot be read off untyped method text without
  a model. What *can* be read dependency-free is the bluntest LSP breach:
  an override that throws where the parent did not.
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).
- **Same slice pattern as SRP/OCP** (ADR-0022, ADR-0030): pure domain
  functions plus one thin `Rule` adapter, exact-string tests, disclosed
  limitations.

## Considered Options

### Option 1: Depend on a real parser plus type information

Precise override resolution (including transitively inherited members),
signature comparison for parameter/return incompatibilities, control-flow
proof of which paths throw.

- **Pros**: Real precondition/postcondition comparison; no regex
  fragility.
- **Cons**: A heavyweight dependency in the published bundle against
  ADR-0008's explicit "no runtime dependencies" constraint; one parser
  per language multiplies the audit surface (ADR-0011); still cannot
  judge *behavioural* compatibility (does the override honour the
  contract?) without symbolic execution.

### Option 2: A dependency-free hierarchy scanner plus an override-throw count (chosen)

Find `class Name [extends Parent] { ... }` constructs and their
top-level methods with a small hand-written scanner, resolve each
subclass's parent only when it is defined in the same subject, and count
overridden methods whose body throws outside of a string or comment. Two
or more throwing overrides is a `violation`; exactly one is `uncertain`;
none is `compliant`; no inheritance at all is `not_applicable` — never
`compliant` — and a subclass of an external parent is `uncertain` for the
same reason: nothing local to compare against.

- **Pros**: Zero dependencies, keeping ADR-0008 intact; the scanner is
  small and fully covered by exact-string tests; the verdict degrades
  gracefully (`uncertain`/`not_applicable`) instead of guessing;
  thresholds are exported constants the corpus (#27) can measure.
- **Cons**: A narrow proxy — contract breaches expressed without a
  `throw` (a narrower return, a stricter parameter check that returns
  instead of throwing, a silently incompatible side effect) are all
  missed. Recall is deliberately traded for precision and honesty about
  uncertainty.

### Option 3: AI-assisted judgment per subject

Send the subject to a language model and report its verdict as
`ai_assisted`.

- **Pros**: Best understanding of whether an override really contradicts
  its abstraction.
- **Cons**: Requires a model provider at analysis time (privacy/data-flow
  review per #28, latency, cost), verdicts are non-deterministic (harder
  to mutation-test and to reproduce in evaluation snapshots, #30).
  Premature before the deterministic/heuristic baseline exists to compare
  against — the same deferral ADR-0022 already made for SRP.

## Decision

Use **Option 2**, structured as pure domain functions plus one thin
`Rule` adapter:

```
packages/core/src/principles/lsp/
  domain/
    supported-language.ts  explicit allow-list (typescript, javascript)
    inheritance.ts         class-hierarchy + method-body extraction,
                           string/comment-aware throw detection
    lsp-assessment.ts      throwing-override verdict thresholds (2/1),
                           unresolved-parent handling
  infrastructure/
    lsp-rule.ts            LspRule (id "solid.lsp") -> AnalysisResult
```

`LspRule` reports one `AnalysisResult` per subject with one piece of
evidence per throwing subclass (declaration lines, never whole files),
always with `method: "heuristic"` (or `"deterministic"` for the
`not_applicable` scope facts), calibrated sub-1.0 confidence (0.55
violation / 0.4 uncertain / 0.65 compliant, mirroring SRP/OCP), the three
known limitations disclosed verbatim, and `humanReviewRecommended` on
everything but `compliant`. Analyzer identity is
`principled-solid-lsp` version `1`, so evaluation snapshots (#30) can
attribute results to this exact implementation. `LspRule` is exported
from `@principled/core` and registered in the web composition roots
(`bin.ts`, `lambda-entry.ts`); the CLI gains nothing because it has no
analysis command yet (#18 owns that).

## Consequences

### Positive

- #12's acceptance criteria are met structurally: structured findings
  with line evidence; strong (`violation`) vs uncertain (`uncertain`,
  `not_applicable`) kept apart by status, not prose; inheritance is
  treated as *one* substitutability shape (subjects without it are out of
  scope, not "fine"), which is what "does not assume inheritance is the
  only form of substitutability" means for a v1 heuristic.
- #28's rule-level obligations fall out of the design: evidence excerpts
  are minimal (`class Dog extends Animal { … }`, never whole files);
  nothing person-level is computed (the rule sees source and language
  only); uncertainty and human-review framing are mandatory fields, not
  documentation.
- #13–#14 get a third worked pattern next to ADR-0022's and ADR-0030's:
  hierarchy extraction with local-only parent resolution, with the same
  confidence scale.

### Negative

- Recall is knowingly narrow: only throwing overrides are read as risk.
  A subclass that honours the letter (no throw) while breaking the
  contract (wrong result, stricter silent precondition) is reported
  `compliant` — the rule understates substitutability risk more often
  than it overstates it.
- Single-subject visibility: a hierarchy split across files cannot be
  resolved, so multi-file projects systematically report `uncertain`
  until project-level analysis (#22) exists to join them.
- Thresholds (2/1 throwing overrides) are reasoned choices, not measured
  ones — tuning them against the corpus (#27) may move them, which is a
  rule-version bump, not a contract change.

### Risks and mitigations

- *Risk*: Users read a `violation` as proof of a broken contract rather
  than a throwing-override heuristic. *Mitigation*: `method:
  "heuristic"`, confidence 0.55, mandatory limitations and human-review
  flag travel with every verdict; the web UI already renders all four
  (ADR-0015's findings view).
- *Risk*: The unresolved-parent `uncertain` trains users to ignore the
  rule on multi-file codebases. *Mitigation*: the explanation names the
  exact missing parent, so the verdict reads as "bring me the parent"
  rather than noise; project-level analysis (#22) is the defined fix.
- *Risk*: A future rule copies the hierarchy scanner instead of sharing
  it. *Mitigation*: same accepted follow-up as ADR-0022's and ADR-0030's
  scanners — deduplication across #11–#14 once the shapes settle, not
  premature abstraction today.

## Related

- #12 (this rule), #13–#14 (sibling SOLID rules, same pattern).
- ADR-0008 (no runtime dependencies — why there is no parser),
  ADR-0013 (the result contract this rule returns),
  ADR-0014 (the engine that runs it), ADR-0022/ADR-0030 (sibling patterns).
- #27 (evaluation corpus — where thresholds get measured),
  #28 (compliance baseline — evidence/human-review obligations),
  #30 (versioned evaluation snapshots — analyzer name/version exists for this).
