# ADR-0038: Mutation testing reports separately, never blocks delivery

**Status**: Accepted
**Date**: 2026-09-20

## Context

ADR-0003 made the Stryker mutation score (break: 95%) a deployment gate:
every push and pull request ran it, and red meant nothing landed. Two
facts broke that posture on the same day:

- The suite outgrew the tooling. At ~1750 tests and ~6300 mutants,
  Stryker 10 crashes serializing the full incremental report
  (`RangeError: Invalid string length` in `writeIncrementalReport`) after
  every mutant already passed. The gate failed at a 99.95 score — the
  number was never the problem.
- A full run takes over an hour. With the gates concurrency group shared,
  each push queued behind the previous push's mutation job, so delivery
  waited on an hour-long advisory signal even when every real gate was
  green.

## Decision Drivers

- Deployment must never wait on an hour-long informational signal.
- Two mutation runs must never pile up: each push supersedes the last.
- The score stays visible and the cache keeps working, so reinstating the
  gate later is cheap.
- No silent scope creep: the blocking aspect of ADR-0003 is suspended
  explicitly, not eroded by `continue-on-error` flags.

## Considered Options

### Option 1: `continue-on-error` on the mutation step (rejected)

- **Pros**: One-line change; deployments flow.
- **Cons**: A red gate that always passes teaches everyone to ignore it,
  and the hour-long job still occupies the shared concurrency group,
  delaying the runs queued behind it. Tried briefly; reverted in favour
  of this ADR.

### Option 2: Standalone advisory workflow (chosen)

- **Pros**: Deployments flow on the fast gates; mutation runs alone on
  its own concurrency group with `cancel-in-progress`, so a new push
  supersedes the stale run instead of queueing behind it. Score,
  HTML report and incremental cache all keep working untouched.
- **Cons**: A dropping score no longer stops anything by itself —
  somebody has to watch the workflow and fix findings forward.

## Decision

- The `mutation` job leaves `gates.yml` for a standalone `mutation.yml`:
  push to `main` plus manual dispatch, own `mutation-<ref>` concurrency
  group with `cancel-in-progress: true`, same cache/report steps.
- The forced-full-run branch keeps the ADR-0037-era fix (plain
  `stryker run --force`, no `--incremental`) until Stryker can serialize
  the full report again.
- Reinstatement is a revert of this ADR plus a header-comment update —
  and requires the serialization crash to be gone first.

## Consequences

### Positive

- Push-to-deploy latency drops by the mutation runtime; no two mutation
  runs ever overlap.
- The score, report artifact and cache survive, so the signal is not
  lost, only decoupled.

### Negative

- Score regressions are advisory until someone acts; the team accepts
  fix-forward instead of gate-blocked.

### Risks and mitigations

- **Score rots unnoticed**: mitigated by keeping the workflow visible on
  every main push and the report artifact a click away; reinstate the
  gate once the crash is fixed and the score is stable.
