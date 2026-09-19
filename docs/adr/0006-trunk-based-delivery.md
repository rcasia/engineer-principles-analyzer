# ADR-0006: Push to main, gate with CI, release and deploy automatically

**Status**: Accepted
**Date**: 2026-09-19

## Context

The project is agentic first, and requires that everything is pushed to main
by default, that the most recent commit on main which passes the gates is
promoted to production, and that releases are automatic.

That only works if the gates are trustworthy. Without them, "push to main" is
just "no review", and an agent can merge a plausible-looking regression
straight into production.

## Decision Drivers

- **Main is always releasable**, because main is what gets deployed.
- **The same checks run locally and in CI**, so failures are found before push
  rather than after.
- **No human in the loop for a green change**, and no deploy for a red one.
- **No secrets required to run the gates**, because the repository is public.

## Considered Options

### Branching

**Option A: Trunk based, direct pushes to main.** Small atomic commits, no
long-lived branches, no merge queue. Matches the stated requirement.

**Option B: Pull request per change with required reviews.** Safer with human
authors, but makes atomic commits expensive and puts a human on the critical
path of every agent change.

### Versioning

**Option A: semantic-release driven by conventional commits.** The commit
messages already carry the intent, and commitlint already enforces their
shape, so the version is derivable rather than decided.

**Option B: Manual version bumps.** One more thing to forget, and it makes
"every green commit is releasable" untrue in practice.

## Decision

**Push straight to main.** Gates run on every push and every pull request, and
are defined once in `gates.yml`, which `main.yml` calls via `workflow_call`.
The two can therefore not drift.

The gates are:

| Gate             | What it proves                                          |
| ---------------- | ------------------------------------------------------- |
| conventional commits | The history stays machine readable, so versioning works |
| typecheck and test   | The code compiles and behaves                       |
| mutation score       | The tests would actually notice a regression (ADR-0003) |
| lambda bundle        | The Node bundle runs, not just the Bun sources      |
| terraform            | Format, validity, and a real apply against LocalStack |

Locally, lefthook runs commitlint on `commit-msg`, typecheck on `pre-commit`
and the test suite on `pre-push` — the fast subset of the same checks.

**Releases are automatic.** semantic-release runs after the gates pass on
main, derives the version from the commit types, writes `CHANGELOG.md`, tags,
and publishes GitHub release notes.

**Deployment follows the release.** The `main-delivery` concurrency group has
`cancel-in-progress: false`, so commits are released and deployed in order
rather than racing. Production credentials are obtained through GitHub OIDC;
there are no long-lived AWS keys in the repository. The deploy job is skipped
while `vars.AWS_DEPLOY_ROLE_ARN` is unset, so the pipeline is green on forks
and before an AWS account exists.

## Consequences

### Positive

- A green commit needs no human action to reach production.
- The mutation gate means "green" is a meaningful claim, not a coverage
  number.
- All gates run with no secrets, so forks and pull requests from anyone get
  the same signal.

### Negative

- **There is no review.** The gates are the only thing between a commit and
  production, and they cannot catch a bad idea, only a broken one.
- A red main blocks everyone until it is fixed, by design.
- Deploy is not verified against real AWS until an account exists; LocalStack
  raises confidence but does not prove parity (ADR-0005).

### Risks and mitigations

- *Risk*: A bad commit reaches production because the gates did not cover it.
  *Mitigation*: Every incident should add a gate, not a process step. Rolling
  forward is a revert commit, which is itself a green deploy.
- *Risk*: `@semantic-release/git` pushes a release commit to main and
  retriggers the pipeline. *Mitigation*: the release commit carries
  `[skip ci]`.
- *Risk*: Direct pushes make it easy to bypass the local hooks with
  `--no-verify`. *Mitigation*: CI re-runs everything the hooks run, so a
  bypass is caught, just later.
