# ADR-0003: Gate on mutation score, not line coverage

**Status**: Accepted
**Date**: 2026-09-19

## Context

The project requires mutation coverage above 95% from the beginning, and
changes are made mostly by agents pushing straight to main. The gate that
protects main is therefore the only thing standing between a plausible-looking
diff and production.

Line coverage does not do that job. It proves a line executed; it says nothing
about whether any assertion would have noticed that line behaving differently.
A test suite of `expect(true).toBe(true)` can reach 100% line coverage. That
failure mode is exactly what an agent-authored test suite drifts towards.

Mutation testing changes the question from "did this line run?" to "if I broke
this line, would a test fail?".

## Decision Drivers

- **The gate must be hard to fake.** Agents optimise for the metric they are
  given.
- **Must run on every push**, so it has to finish in seconds at this size.
- **Must work with `bun test`** (ADR-0001).

## Considered Options

### Option 1: StrykerJS with the `command` runner

- **Pros**: The runner is runtime-agnostic — it shells out to `bun test`, so
  Stryker never needs to understand Bun. Ships a break threshold that exits
  non-zero. Mature TypeScript mutation support.
- **Cons**: Runs the whole suite per mutant (`coverageAnalysis: "off"`), which
  is O(mutants x suite). Stryker itself runs on Node, not Bun.

### Option 2: StrykerJS with a native test-runner plugin

- **Pros**: Per-test coverage analysis, so only relevant tests rerun.
- **Cons**: No Bun runner plugin exists. Would mean adopting Vitest purely to
  satisfy the mutation tool, adding the tool ADR-0001 set out to avoid.

### Option 3: Line coverage threshold only

- **Pros**: Free, instant, built into `bun test`.
- **Cons**: Measures the wrong thing, as above. Rejected.

## Decision

Use **StrykerJS with the `command` runner shelling out to `bun test`**, with
`thresholds.break` set to **95**. The mutation run is a required CI gate, not
a report.

`mutate` excludes `*.test.ts` and each package's `index.ts`, which is a
re-export barrel with no behaviour to mutate.

**TypeScript is pinned to 5.x.** TypeScript 7 (the Go rewrite) no longer
exposes the legacy compiler API that Stryker's tsconfig preprocessing calls,
and Stryker crashes against it. This is the concrete cost of Option 1.

## Consequences

### Positive

- The suite is verified to be sensitive, not merely present. At the time of
  writing: 28 mutants, 28 killed, 100%.
- The threshold is enforced by exit code, so it cannot be ignored by a bot.
- Writing to kill mutants pushes tests toward boundaries (`0`, `100`, `-1`,
  `101`, `NaN`) rather than one happy-path case.

### Negative

- Runtime grows with the product of mutant count and suite duration. This is
  free today and will not stay free.
- TypeScript is held a major version behind because of the mutation tool. That
  is a real constraint accepted deliberately.
- Stryker requires Node available alongside Bun.

### Risks and mitigations

- *Risk*: The full mutation run becomes too slow to gate every push.
  *Mitigation*: Stryker supports incremental mode (`--incremental`), which only
  re-tests mutants affected by the diff. Switch when the wall clock justifies
  it, not before.
- *Risk*: 95% becomes a ceiling that contributors game with Stryker-disable
  comments. *Mitigation*: Disable comments are visible in review; surviving
  mutants are reported per file in the HTML report.
