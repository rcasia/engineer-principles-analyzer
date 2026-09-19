# ADR-0021: Cache Stryker incremental reports, forcing full runs on test changes

**Status**: Accepted
**Date**: 2026-09-20

## Context

ADR-0003 chose StrykerJS with the `command` runner (`bun test`) and a 95
break threshold, predicting the full run would get slow and naming
`--incremental` as the mitigation to switch on when the wall clock justified
it. That moment has arrived: the suite now instruments 41 source files with
1006 mutants, so every push re-runs the whole suite once per mutant.

Stryker's incremental mode stores results in
`reports/stryker-incremental.json` and reuses mutant results whose code did
not change. Verified locally: a second run over an unchanged file reuses 22
of 22 results and finishes in under a second.

There is one trap that makes naive `--incremental` unsound here. Our runner
is `command`, which reports no test coverage and no test locations. Stryker
is explicit about that combination: incremental mode then "will only detect
changes in mutants, not their tests". The reuse check in Stryker's
`incremental-differ` confirms it — when the runner reports no coverage, any
mutant whose own file did not change is reused unconditionally. A commit
that only weakens a test (or only adds the test that kills a survivor)
would therefore keep the previous score and stay green while the real score
moved.

## Decision Drivers

- **The gate must stay sound.** A cached green must mean the current tests
  kill the current mutants, especially for test-only changes.
- **Pushes must stay fast.** The mutation job gates every push and PR; its
  runtime should scale with the diff, not the mutant count.
- **Fork PRs must stay green-capable.** Cache writes need a write token,
  which fork runs do not have; a missing cache must degrade to a full run,
  never to a red gate.

## Considered Options

### Option 1: `--incremental` everywhere, no guard

- **Pros**: Simplest change; maximum reuse on every run.
- **Cons**: Test-only changes are invisible to the differ, so weakened tests
  pass the gate and new killing tests do not move the score. The gate that
  ADR-0003 calls "the only thing standing between a plausible-looking diff
  and production" would go blind exactly when tests change. Rejected.

### Option 2: Incremental with a CI cache and a force-on-test-change guard

- **Pros**: Source-only diffs skip to seconds; test, dependency or config
  changes force a full re-run (`--incremental --force`, which also refreshes
  the cache), keeping the gate sound. Cache misses degrade to today's full
  run, so forks and first runs are unaffected.
- **Cons**: The force heuristic is a `git diff` allowlist (`*.test.ts`,
  `package.json`, `bun.lock`, `stryker.config.json`) that must be kept in
  sync with what can influence a run. The cache adds per-commit entries to
  the Actions cache (each run saves under a per-SHA key).

### Option 3: Stay on full runs

- **Pros**: No new machinery, no soundness caveat.
- **Cons**: Runtime grows with mutants × suite on every push; at 1006
  mutants the gate is already the slowest job and will only get slower.
  Rejected — this is the cost ADR-0003 said to switch away from.

## Decision

Use **Option 2**:

- `stryker.config.json` pins `incrementalFile` to
  `reports/stryker-incremental.json` (already gitignored via `reports/`) but
  leaves `incremental` off, so `bun run test:mutation` stays a full, sound
  run. Fast local feedback is opt-in via the new
  `bun run test:mutation:incremental` (`stryker run --incremental`).
- The `mutation` job in `gates.yml` restores the previous incremental
  report from the Actions cache (falling back to the `main` cache for PRs),
  runs `--incremental`, and saves the refreshed report — except on fork PRs,
  where the save is skipped.
- Before running, the job diffs the range against the base commit and passes
  `--force` when test files, dependencies, or the Stryker config changed,
  because the `command` runner cannot see those changes.

## Consequences

### Positive

- Incremental pushes that touch only sources re-test only affected mutants;
  the typical agent-sized diff drops from minutes toward the dry-run floor.
- The gate reports the full score either way, so the threshold semantics in
  ADR-0003 are unchanged.
- Local iteration gets the same speedup without touching the safe default.

### Negative

- CI now depends on cache availability; a cold cache is a slow (but
  correct) full run, e.g. the first run after this lands.
- The force heuristic duplicates knowledge about which files influence a
  run. If a new input appears (e.g. a shared test helper outside
  `*.test.ts`, a `bunfig.toml`, environment variables), it must be added to
  the diff list or test changes there will be missed.

### Risks and mitigations

- *Risk*: The allowlist misses a file kind that changes test outcomes.
  *Mitigation*: The `*.test.ts` pattern covers colocated tests, which is
  where this repo's tests live; review treats silent incremental reuse on a
  test-touching diff as a bug, and anyone can force a full run with
  `bun run test:mutation`.
- *Risk*: A stale or poisoned cache masks a real failure.
  *Mitigation*: Reuse only ever carries forward results for mutants whose
  own file is byte-identical to the cached run; any mutant-file change
  re-runs. `--force` refreshes rather than deletes, so the cache converges
  back to full-run state on every forced run.
