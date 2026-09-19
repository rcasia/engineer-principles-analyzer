# ADR-0013: Define a single, validated `AnalysisResult` contract

**Status**: Accepted
**Date**: 2026-09-19

## Context

The rule evaluation engine (#9) does not exist yet, but the CLI, the web UI
and the evaluation framework (#30) all need to agree, before any rule is
written, on the shape one rule evaluation returns. Getting this wrong is
expensive to fix later: it is imported everywhere a rule result is produced
or consumed.

The shape has to satisfy constraints that pull in different directions:

- It must work for **any** rule and **any** language — the catalog is still
  empty (#10–#14), so the contract cannot assume SOLID-specific fields.
- It must represent a **probabilistic** judgment honestly. Some rules will be
  deterministic (a parser either finds a cycle or it doesn't); others will be
  AI-assisted. A contract that only has "pass"/"fail" forces an AI-assisted
  guess to be reported with the same certainty as a compiler error, which the
  compliance baseline (#28) explicitly forbids: AI-assisted output must never
  be presented as deterministic fact.
- It must not become a place to leak customer source code. The compliance
  baseline requires evidence to be minimized to useful excerpts and
  locations, not full files (#28).
- It must leave room for project-level findings (#22) without a breaking
  change — a single-file result already needs to look enough like a
  project-level one that no future contract has to be invented from scratch.

## Decision Drivers

- **Cannot be a bag of optional strings.** If every field is an optional
  `string`, a mutant that deletes a check has nothing to fail against, and
  the mutation-testing gate (ADR-0003) demands 95%+ or the build breaks. The
  contract needs actual invariants a test can kill a mutant on.
- **Language-independent.** No field may assume a specific language's syntax
  or tooling.
- **Usable identically from the CLI and the web UI.** Both already depend on
  `@principled/core`; the contract just needs to be part of its public
  surface, not a second definition duplicated per adapter.
- **Validation failures are not exceptional.** An out-of-range confidence, an
  empty rule id, or a violation with no evidence are ordinary, anticipated
  outcomes of validating input that ultimately comes from a rule
  implementation (#9), a CLI flag, or a web form — not a bug in the program.
  Throwing turns an anticipated case into control flow a caller can forget to
  handle; a caller cannot forget to check a return value the type system
  requires it to look at first.

## Considered Options

### Option 1: Plain data interface, validated by callers

`interface AnalysisResult { status: string; confidence: number; ... }`, with
callers responsible for checking bounds.

- **Pros**: Minimal code, fastest to add a field to later.
- **Cons**: Every producer (eventually multiple rule implementations, #9) and
  every consumer re-implements the same validation or skips it. An
  out-of-range confidence or an invented status string becomes representable
  and silently wrong. No enforcement point for the compliance requirements
  above.

### Option 2: A single validated `AnalysisResult` value object composed of smaller value objects

Follow the construction pattern already established by `Score` (ADR-0002): a
private constructor and a `.of()` factory that is the only way to obtain an
instance, backed by dedicated value objects (`Confidence`, `SourceLocation`,
`Evidence`) for the parts that have their own rules. Unlike `Score.of`, the
factory reports failure by returning a `Result<T, E>` value object (a new
`packages/core/src/shared/result.ts`) instead of throwing, per the driver
above.

- **Pros**: Invalid states are unrepresentable once constructed. Invariants
  that encode the compliance requirements (below) live in one place and are
  exercised by mutation testing like the rest of the domain. A caller gets a
  compile error, not a runtime surprise, if it reads `.value` without first
  checking `.ok`.
- **Cons**: More files and more validation code than the behaviour currently
  justifies, mirroring the "stub domain" cost already accepted in ADR-0002.
  `Score.of` still throws (ADR-0002 predates this decision), so the package
  now has two error-handling conventions until `Score` is revisited.

### Option 3: A discriminated union per status

`{ status: "violation"; evidence: Evidence[] } | { status: "compliant" } | ...`
so the type system enforces which fields exist for which status.

- **Pros**: Some invariants (e.g. "a violation has evidence") become
  compile-time guarantees instead of runtime checks.
- **Cons**: Every consumer (rendering, serialization, the eventual evaluation
  framework) has to switch on `status` to read anything, for five variants
  that mostly share the same fields. Given the domain is still a stub and the
  rule engine does not exist yet, this locks in a shape that has not been
  exercised by a real rule.

## Decision

Use **Option 2**: `AnalysisResult.of(props)` returns
`Result<AnalysisResult, InvalidAnalysisResultError>` — an immutable value
object on success, an error value on failure, never a throw for a validation
failure. Lives at `packages/core/src/analysis/domain/`, a new vertical slice
per ADR-0002, plus one file shared by every slice's value objects.

```
packages/core/src/shared/
  result.ts              Result<T, E> — ok(value) | err(error), plus
                          unwrap/unwrapErr for the boundaries that must throw

packages/core/src/analysis/domain/
  analysis-status.ts     AnalysisStatus: compliant | violation | uncertain
                          | not_applicable | unable_to_analyze
  analysis-method.ts     AnalysisMethod: deterministic | heuristic | ai_assisted
  confidence.ts          Confidence — a probability in [0, 1]
  source-location.ts     SourceLocation — file/line/column, no source text
  evidence.ts            Evidence — a SourceLocation plus a minimal excerpt
  analyzer-metadata.ts   AnalyzerMetadata — { name, version }
  analysis-result.ts     AnalysisResult — composes all of the above
```

Every `.of()` factory in this slice (`Confidence`, `SourceLocation`,
`Evidence`, `AnalysisResult`) returns a `Result` rather than throwing.
`unwrap`/`unwrapErr` exist for the two places throwing is still the right
tool — a test asserting a fixture is well-formed, or a future boundary
adapter that has already guaranteed success and would rather crash loudly
than silently swallow a state that should be unreachable — not for reporting
an ordinary validation failure.

Fields, and why each exists:

| Field | Purpose |
| --- | --- |
| `ruleId` | Which rule produced this result. |
| `status` | One of five outcomes — see below. |
| `confidence` | How sure the analyzer is, as a probability. |
| `method` | `deterministic` \| `heuristic` \| `ai_assisted` — how the verdict was reached. |
| `evidence` | Minimal excerpts + locations backing the status. Never the whole file. |
| `explanation` | Human-readable rationale. |
| `remediation` | Optional suggested fix (full suggestion generation is #21). |
| `language` | The language the subject was analyzed as. |
| `analyzer` | `{ name, version }` — which implementation produced this. |
| `limitations` | Known weaknesses of this specific result. |
| `humanReviewRecommended` | Explicit, not inferred from confidence alone. |
| `evaluationMetadata` | Optional linkage to a versioned evaluation snapshot (#30). Never a user-tracking field. |

Five statuses instead of two (`pass`/`fail`), because `uncertain`,
`not_applicable` and `unable_to_analyze` are real outcomes a rule can reach
and are not the same thing: an analyzer that could not parse the input failed
to run, which is different from one that ran and could not decide, which is
different from a rule that simply does not apply to this input.

The factory returns an error value for three cross-field invariants that
exist specifically to satisfy the compliance requirements in #28, and that a
construction-time check can actually verify:

1. **A `deterministic` result must report maximum confidence.** A fixed
   procedure that hedges its own answer is a contradiction — if the method is
   not actually certain, it is not deterministic.
2. **A `violation` must carry at least one piece of evidence.** An
   accusation with nothing to point at is not a finding a user can act on or
   dispute.
3. **An `uncertain` status must recommend human review.** The system should
   never be more confident in its output than it is in its own judgment.

`Evidence` deliberately holds a minimal `excerpt`, not a reference to the
whole submitted file, so the contract itself makes the compliance
requirement to minimize retained source ("evidence minimized to useful
excerpts/locations") the easy path rather than something bolted on later.

## Consequences

### Positive

- Every field that has a well-defined range (`Confidence`, `SourceLocation`)
  is unrepresentable outside that range, the same guarantee `Score` already
  gives the principles slice.
- The three cross-field invariants above encode the compliance and product
  requirements directly in the type that both the CLI and web UI consume,
  instead of leaving them as documentation any renderer could ignore.
- A validation failure is a value the caller's type checker forces it to
  look at (`if (!result.ok) ...`) before it can reach the success case,
  instead of a throw a caller can forget to catch — which matters here more
  than usual, because callers include a future rule engine (#9) running many
  independently-authored rules, where one rule's uncaught throw must not be
  able to take down the whole evaluation run.
- `packages/core/src/index.ts` is the only place these types are exported
  from, so `packages/cli` and `packages/web` get an identical contract with
  no duplication.
- Field-level mutation testing on this slice plus `shared/result.ts` reaches
  99.03% (2 of 207 mutants survive, both in `SourceLocation`'s same-line
  column comparison, and are behaviourally equivalent: comparing a defined
  column against an `undefined` one is always `false` in JavaScript
  regardless of the guard that precedes it, so no input can distinguish the
  mutant from the original — the guard exists for TypeScript's type
  narrowing, not for runtime behaviour), comfortably above the 95% break
  threshold (ADR-0003).

### Negative

- More files and more validation than a plain interface, for a contract no
  rule implementation exists to exercise yet — the same stub-domain cost
  ADR-0002 already accepted, paid again here.
- The invariants encode assumptions (e.g. "deterministic implies maximum
  confidence") that #9's actual rule implementations have not yet tested
  against a real rule. If a legitimate rule needs a deterministic method with
  partial confidence, this ADR will need to be revisited rather than the
  check quietly relaxed.
- `evaluationMetadata` is a free-form string map for now, because #30's
  snapshot format does not exist yet. It will likely need a dedicated type
  once that format is defined.
- `@principled/core` now has two error-reporting conventions side by side:
  `Score.of` throws `InvalidScoreError`, while everything in this slice
  returns a `Result`. A caller cannot tell which convention a given `.of()`
  follows without checking its return type.

### Risks and mitigations

- *Risk*: A future rule needs a status or method this contract does not have
  (e.g. a `skipped` status for a disabled rule). *Mitigation*: `status` and
  `method` are each a single exported string-literal union with a type guard
  (`isAnalysisStatus`, `isAnalysisMethod`), so adding a case is a one-line
  change reviewed in one place, not a breaking change to every field.
- *Risk*: `evidence`'s minimal-excerpt design is not actually enforced —
  nothing stops a future caller from passing an entire file as the excerpt.
  *Mitigation*: `Evidence.of` rejects an empty excerpt but cannot judge
  "how much is too much" without knowing the source; enforcing an excerpt
  size limit is left as a follow-up for the engine that produces evidence
  (#9), where the original source is available to bound against.
- *Risk*: Nothing yet renders or serializes `AnalysisResult` to JSON for the
  CLI's machine-readable output. *Mitigation*: deliberately out of scope —
  tracked as #19, which can serialize this contract without changing it.
- *Risk*: The two coexisting error-reporting conventions (`Score` throws,
  this slice returns `Result`) could spread inconsistently if new code picks
  whichever one is closer at hand. *Mitigation*: this ADR states the rule
  going forward — throw only for a programmer error or a truly unexpected
  failure, return a `Result` for anything an untrusted caller could
  reasonably trigger — and treats `Score` as the outlier to reconcile in a
  follow-up, not the precedent to keep copying.
