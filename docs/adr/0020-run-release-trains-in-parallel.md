# ADR-0020: Run the release trains in parallel, retrying the push race

**Status**: Accepted
**Date**: 2026-09-19

## Context

ADR-0016 ran the two release trains in sequence (`release-web` after
`release-cli`) for one reason: both push a release commit and tag to `main`
via `@semantic-release/git`, and two semantic-release processes pushing at
the same time race. The trains themselves are independent - each only
releases the commits that touched its own files or core (ADR-0019) - so the
ordering bought safety at the cost of pipeline latency on every push.

## Decision Drivers

- **Independent work runs concurrently.** Waiting on an unrelated train on
  every push is latency with no safety benefit on runs where only one
  train releases, which is the common case.
- **No human in the loop for a green change** (ADR-0006). Whatever handles
  the both-trains-release race must be automated; a job that fails and
  waits for someone to re-run it is a process step, not a gate.
- **Bound the race, don't wish it away.** On runs where both trains cut a
  release (e.g. a `core` commit), exactly one push wins and the other is
  rejected non-fast-forward. The fix must make the loser converge, not
  merely document the failure.

## Considered Options

### Option 1: Naive parallel, no retry

Both jobs `needs: gates`, `deploy` needs both. Simple, and correct whenever
at most one train releases.

- **Pros**: Smallest diff.
- **Cons**: On both-release runs the loser's push is rejected and the job
  fails, blocking `deploy` until a human re-runs it. `core` commits release
  both trains by design, so this is not a corner case - it is the expected
  outcome of the most common shared change. Rejected: it trades latency for
  manual toil, against ADR-0006.

### Option 2: Parallel with retry-with-resync on the Release step (chosen)

Same job graph as option 1, but each Release step retries up to three
times: on failure it fetches `main` and resets to the new tip before
re-running semantic-release.

- **Pros**: The loser converges automatically. Its retry is clean because
  the winner's release commit touches only the winner's files, so the
  loser's file filter (ADR-0019) excludes it and the re-analysis proceeds
  from the new tip as if the winner had always been there. Livelock is
  impossible: the workflow-level `main-delivery` concurrency group already
  serializes runs, so the sibling train is the only concurrent pusher -
  one retry always suffices, three attempts bound it.
- **Cons**: A genuinely broken release step (bad config, failing prepare)
  now fails three times instead of once, adding a few minutes to a red
  run before it goes red. The retry also re-runs the sibling-exclusion
  logic implicitly rather than stating it - the reader must know the
  filter excludes the winner's commit for the "clean retry" claim to hold.

### Option 3: One job running both releases sequentially

A single `release` job checking out once and invoking both configs in one
shell. No race possible, no retry needed.

- **Pros**: No concurrency to reason about at all.
- **Cons**: Still sequential - it answers the race by declining the
  parallelism that was asked for. Rejected on those grounds alone.

## Decision

**Option 2.** `release-cli` and `release-web` both `needs: gates`;
`deploy` needs both. Each Release step wraps semantic-release in a
three-attempt loop with `git fetch origin main` + `git reset --hard
origin/main` between attempts. Both release checkouts use `ref: main` so a
direct push landing while the gates ran doesn't start either job stale.

## Consequences

### Positive

- Release latency on every push drops by roughly one semantic-release run
  whenever both trains have work, and is unchanged when only one does.
- Both-release runs converge without human action: one train wins, the
  other re-syncs and completes.

### Negative

- Red releases take longer to go red (up to three full attempts).
- The retry's correctness rests on the ADR-0019 filter excluding the
  winner's release commit; if the path lists ever misclassify a release
  commit as belonging to the other train, a retry would loop three times
  and fail instead of converging once.

### Risks and mitigations

- *Risk*: Partial failure between commit push and tag push leaves a tag
  unpushed that a retry won't recreate (the release commit is already on
  `main`, so re-analysis finds nothing new). *Mitigation*: accepted as-is;
  the same hole exists under sequential ordering, and it needs a network
  failure in a seconds-wide window rather than an everyday race.
- *Risk*: A future third train triples the racers. *Mitigation*: the retry
  bound still converges (losers re-sync one by one), but revisit this ADR
  if trains multiply - the per-train push model doesn't scale indefinitely.
