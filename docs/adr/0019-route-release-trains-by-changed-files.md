# ADR-0019: Route release trains by changed files, not commit scope

**Status**: Accepted
**Date**: 2026-09-19

## Context

ADR-0016 split the CLI and web into independent release trains but routed
commits to them by commit message scope: a commit scoped `cli` counted
toward the CLI train, `web`/`infra` toward the web train, `core` and
cross-cutting scopes toward both.

A message scope is a claim a human or agent makes about a commit; the
changed files are what's actually true. The two can disagree - a scope can
be mistyped, omitted, or simply broader than the diff - and when they do,
the trains release on the claim instead of the truth. The scope filter was
also coupled to the exact commitlint scope enum: every new package meant
updating both `commitlint.config.mjs` and the filter's scope lists in lock
step, or commits against the new package would silently count as
cross-cutting on every train.

The requirement is unchanged: the trains stay independent, and a `core`
change affects both, because core is bundled into the CLI and called
directly by the web adapter.

## Decision Drivers

- **Truth over claim.** What a commit changed decides which train it
  belongs to, not what its message says it changed.
- **Core affects both, nothing else drags the other train in.** A commit
  mixing one train's files with incidental cross-cutting docs or CI config
  is still that train's commit.
- **No new dependency.** Same constraint as ADR-0016: a small local filter,
  not a monorepo-aware semantic-release plugin doing a git diff per commit
  behind another layer of abstraction.

## Considered Options

### Option 1: Keep routing by commit scope (ADR-0016 as-is)

- **Pros**: No change; already shipped and verified in production
  (`web-v1.0.0` cut independently of `v1.12.1`).
- **Cons**: Routes on the claim, not the diff. Coupled to the commitlint
  scope enum. An unscoped or cross-cutting-scoped commit counts toward
  both trains even when its diff is single-package.

### Option 2: Exclude a commit only when every file it touched belongs to the other train

Considered and rejected during implementation: requiring *all* files to be
other-side-exclusive is too strict to be useful. A `feat(cli)` commit that
touches `scripts/publish-cli.ts` plus incidental `docs/`, `README.md` and
`.github/` files is not "exclusively" anything, so it falls through to
both trains - exactly the cross-contamination the split exists to prevent.
Verified against real history: `c9c7c6b` (CLI feature + docs + CI) would
have released the web train under this rule.

### Option 3: Symmetric file routing with explicit per-train path lists (chosen)

Each train declares the paths that belong exclusively to it (`CLI_PATHS`,
`WEB_PATHS` in `scripts/scoped-release-plugins.mjs`); `packages/core/` is
shared and listed separately (`CORE_PATHS`). A commit belongs to a train
when it touched that train's paths or core; a commit touching only the
other train's paths is excluded; anything else - only cross-cutting files,
or no files at all (merges, which `git diff-tree` reports empty) - counts
toward both.

- **Pros**: Routes on the diff. Checking the own side first means
  incidental cross-cutting files can't drag the other train in. New
  single-package paths are added to one list; anything unlisted defaults
  to cross-cutting (both trains), which is the safe direction for a missed
  entry.
- **Cons**: Two path lists to maintain instead of one scope list.
  `scripts/` and `docs/design/` needed per-file/per-directory judgement
  calls (a CLI script next to a Lambda script; a web-only design system
  with no CLI equivalent) that a future contributor could get wrong.

### Option 4: A monorepo-aware semantic-release plugin

- **Pros**: The ecosystem-standard answer; no local filter to maintain.
- **Cons**: Same rejection as in ADR-0016: another dependency to keep
  patched, largely unmaintained upstream, doing per-commit git diffs for
  information a ~40-line local function already extracts.

## Decision

**Option 3.** `scripts/scoped-release-plugins.mjs` filters on
`git diff-tree --name-only` output per commit, with the rule above.
`release.cli.config.mjs` passes `(CLI_PATHS, WEB_PATHS)`;
`release.web.config.mjs` passes `(WEB_PATHS, CLI_PATHS)`. Nothing else
about the trains changes: same tag formats, changelogs, sequential
`release-cli` then `release-web` ordering, and `deploy` depending on
`release-web`.

Validated against real history, not just synthetic cases: a `feat(web)`
commit touching `packages/web/` + `docs/design/` routes web-only; a
`feat(core)` commit routes to both; a `fix(infra)` commit touching
`infra/` + `scripts/check-deployed.ts` routes web-only; a `feat(cli)`
commit touching `scripts/publish-cli.ts` + docs + CI routes CLI-only.

## Consequences

### Positive

- The trains are independent in the sense that was asked for: a
  single-package diff releases exactly one train, and only a `core` diff
  (or a genuinely cross-cutting one) releases both.
- Mis-scoped or unscoped commits can no longer misroute a release; the
  filter never reads the message at all.
- The commitlint scope enum and the release filter are decoupled; adding
  a scope no longer silently changes release routing.

### Negative

- Path lists are a new maintenance surface: a new CLI-only or web-only
  script defaults to cross-cutting (both trains release) until someone
  adds it to `CLI_PATHS`/`WEB_PATHS`. Deliberate - a spurious release on
  both trains is louder and safer than a silently missed one - but still a
  list to keep in sync.
- `docs/design/` classified wholesale as web, and `scripts/` classified
  per file, are judgement calls baked into constants. A future docs
  directory with the same ambiguity would need the same explicit decision.

### Risks and mitigations

- *Risk*: A commit mixing CLI *and* web files releases both trains, even
  if the mix was accidental rather than intentional. *Mitigation*: atomic
  commits (one reason per commit) already forbid such mixes; the filter
  treating them as both-affected matches their actual blast radius.
- *Risk*: Merge commits report no files and count toward both trains.
  *Mitigation*: trunk-based delivery means merges are rare (dependabot
  only); counting them on both trains is the conservative fallback, same
  as the old filter's treatment of unscoped commits.
