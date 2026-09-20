# ADR-0035: Detect Dependency Inversion violations with a dependency-free import-and-instantiation heuristic

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #14 asks for a rule that flags potential Dependency Inversion
Principle violations: high-level code depending directly on
infrastructure, concrete dependencies, missing dependency injection,
abstraction boundaries, and the direction of dependencies — accounting
for language-specific idioms.

The rule runs inside the engine built in ADR-0014, returns the
`AnalysisResult` contract from ADR-0013, and must satisfy the compliance
baseline (#28) like its siblings (ADR-0022, ADR-0030, ADR-0032,
ADR-0034): findings attributable to code evidence, no person-level
profiles, and confidence/uncertainty semantics with human-review
framing. It also has to fit the CLI's distribution model:
`packages/cli` is bundled for Node with no runtime dependencies
(ADR-0008), and `core` ships none — so the rule cannot depend on a real
parser even though a parser is the "proper" way to resolve imports to
the modules they name.

## Decision Drivers

- **Zero runtime dependencies.** Anything the rule imports ships in the
  `principled` npm tarball (ADR-0008).
- **Honest uncertainty over false precision.** One infrastructure import
  can be a careful, narrow adapter — or the first of many concrete
  couplings. A single signal is worth flagging as ambiguous, not
  condemning.
- **Specifiers are strings; strings are noise.** The rule's scanner
  blanks strings, templates and comments so `new Pool()` inside a string
  never counts — but a module specifier *is* a string, so the one string
  in `from`/`require()`/`import()` position must survive stripping. The
  scanner has to know that position explicitly.
- **Mutation-tested at the same bar as everything else** (ADR-0003, 95%).
- **Same slice pattern as SRP/OCP/LSP/ISP** (ADR-0022, ADR-0030,
  ADR-0032, ADR-0034): pure domain functions plus one thin `Rule`
  adapter, exact-string tests, disclosed limitations.

## Considered Options

### Option 1: Depend on a real parser plus module resolution

Precise import graphs (including re-exports through barrels and path
aliases), resolved to the concrete modules they name, joined against
injection sites to tell "imported once at the composition root" from
"scattered through high-level logic".

- **Pros**: Genuine direction-of-dependency evidence instead of a count
  proxy; resolves the "narrow adapter" false positive.
- **Cons**: A heavyweight dependency in the published bundle against
  ADR-0008's explicit "no runtime dependencies" constraint; real
  direction analysis needs multi-file project analysis (#22), which does
  not exist yet — this rule's input is one subject, by engine design
  (ADR-0014).

### Option 2: A dependency-free specifier-aware scanner plus fixed signal thresholds (chosen)

Blank strings, templates and comments except the string in
import/export-from/require/dynamic-import position, then count two
signal groups: imports of a fixed infrastructure-module list
(filesystems, sockets, databases, brokers, cloud SDKs — exact or
prefix-matched, never relative) and direct `new` instantiations of
concrete infrastructure names (by suffix like `Client`/`Pool`/`Broker`,
or by being imported from an infrastructure module). Two or more
signals is a `violation`; exactly one is `uncertain`; zero is
`compliant`; unsupported languages are `not_applicable` — never
`compliant`.

- **Pros**: Zero dependencies, keeping ADR-0008 intact; the
  specifier-position rule is a small lookbehind fully covered by
  exact-string tests (a commented-out import never counts, a fake
  import inside a string never counts); the verdict degrades gracefully
  (`uncertain`/`not_applicable`) instead of guessing; thresholds are
  exported constants the corpus (#27) can measure.
- **Cons**: A count proxy, not a direction proof — a single careful
  adapter import is reported exactly like scattered concrete coupling
  (disclosed as a limitation, not hidden), and anything outside the
  fixed module list (a new client library, an in-house wrapper) is
  invisible. Recall of "unknown infrastructure" is deliberately traded
  for precision on "known infrastructure named directly".

### Option 3: AI-assisted judgment per subject

Send the subject to a language model and report its verdict as
`ai_assisted`.

- **Pros**: Best understanding of whether an import is a narrow adapter
  or real coupling, and of language-specific injection idioms.
- **Cons**: Requires a model provider at analysis time (privacy/data-flow
  review per #28, latency, cost), verdicts are non-deterministic (harder
  to mutation-test and to reproduce in evaluation snapshots, #30).
  Premature before the deterministic/heuristic baseline exists to compare
  against — the same deferral ADR-0022 already made for SRP.

## Decision

Use **Option 2**, structured as pure domain functions plus one thin
`Rule` adapter:

```
packages/core/src/principles/dip/
  domain/
    supported-language.ts  explicit allow-list (typescript, javascript)
    dependency-signals.ts  specifier-aware noise stripping + infra-import
                           and concrete-instantiation counts + first-signal
                           locator
    dip-assessment.ts      signal-count verdict thresholds (2/1)
  infrastructure/
    dip-rule.ts            DipRule (id "solid.dip") -> AnalysisResult
```

`DipRule` reports one `AnalysisResult` per subject with the first
signal's line as evidence (whenever at least one signal exists), always
with `method: "heuristic"` (or `"deterministic"` for the
`not_applicable` scope fact), calibrated sub-1.0 confidence (0.55
violation / 0.4 uncertain / 0.65 compliant, mirroring the four sibling
rules), the three known limitations disclosed verbatim, and
`humanReviewRecommended` on everything but `compliant`. Analyzer
identity is `principled-solid-dip` version `1`, so evaluation snapshots
(#30) can attribute results to this exact implementation. `DipRule` is
exported from `@principled/core` and registered in the web composition
roots (`bin.ts`, `lambda-entry.ts`); the CLI gains nothing because it
has no analysis command yet (#18 owns that).

## Consequences

### Positive

- #14's acceptance criteria are met structurally: structured findings
  with line evidence; strong (`violation`) vs uncertain (`uncertain`,
  `not_applicable`) kept apart by status, not prose; language-specific
  idioms (`import`/`require`/dynamic `import`, `node:` prefixes,
  scoped packages) read as the language actually writes them.
- #28's rule-level obligations fall out of the design: evidence excerpts
  are a single trimmed line, never whole files; nothing person-level is
  computed (the rule sees source and language only); uncertainty and
  human-review framing are mandatory fields, not documentation.
- The five SOLID stories (#10–#14) now share one confidence scale, one
  evidence policy family, and one limitations convention — the corpus
  (#27) can measure all five side by side with no per-rule special
  casing in the harness.

### Negative

- Precision risk is structural: narrow-adapter imports are reported
  exactly like scattered concrete coupling. The limitation is disclosed
  on every verdict, but a user in a hurry will still read a `violation`
  as "you coupled this" rather than "two concrete namings deserve a
  second look".
- The fixed module list rots as libraries change: every new client
  library is invisible until someone adds it, and every addition is a
  recall change that should move the rule version, not just the list.
- Thresholds (2/1 signals) are reasoned choices, not measured ones —
  tuning them against the corpus (#27) may move them, which is a
  rule-version bump, not a contract change.

### Risks and mitigations

- *Risk*: Users read a `violation` as proof of inverted dependencies
  rather than a naming heuristic over one file. *Mitigation*: `method:
  "heuristic"`, confidence 0.55, mandatory limitations and human-review
  flag travel with every verdict; the web UI already renders all four
  (ADR-0015's findings view).
- *Risk*: The module list drifts from the ecosystem and recall silently
  rots. *Mitigation*: rule-level precision/recall/FPR/FNR against the
  versioned corpus (#27, #30) is the defined feedback loop; list growth
  is a rule-version bump.
- *Risk*: The specifier-position lookbehind misfires on exotic but valid
  syntax (import attributes, `import defer`). *Mitigation*: the strict
  word-boundary patterns fail closed (a missed specifier under-counts
  toward `compliant`, never invents a signal), and the corpus measures
  the miss rate.

## Related

- #14 (this rule); #10–#13 (sibling SOLID rules, same pattern).
- ADR-0008 (no runtime dependencies — why there is no parser),
  ADR-0013 (the result contract this rule returns),
  ADR-0014 (the engine that runs it),
  ADR-0022/ADR-0030/ADR-0032/ADR-0034 (sibling patterns).
- #27 (evaluation corpus — where thresholds and the module list get measured),
  #28 (compliance baseline — evidence/human-review obligations),
  #30 (versioned evaluation snapshots — analyzer name/version exists for this).
