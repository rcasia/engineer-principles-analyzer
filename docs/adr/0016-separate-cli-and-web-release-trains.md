# ADR-0016: Split the CLI and web release trains by commit scope

**Status**: Accepted
**Date**: 2026-09-19

## Context

ADR-0006 made releases automatic: semantic-release runs once after the gates
pass on main, derives a version from every commit since the last tag, tags
it, and writes `CHANGELOG.md`. ADR-0008 pointed that one release train at the
CLI - it bumps `packages/cli/package.json`, builds the tarball, and
(optionally) publishes it to npm.

That single train also versions commits that have nothing to do with the
CLI. `feat(web): establish product design foundation` (085e11c) touched only
`packages/web`, yet it released `principled@1.5.0`, is the sole entry in that
version's `CHANGELOG.md`, and would have shipped to npm as a CLI release note
had `NPM_PUBLISH` been on. The web app and the CLI are independent artifacts
- one is a Lambda behind CloudFront, the other an npm tarball - with no
shared release cadence, so a commit to one has no business bumping the
version, changelog, or (eventually) published package of the other.

Every commit here already carries a commitlint-enforced scope naming the
package it changes (`commitlint.config.mjs`: `core`, `cli`, `web`, `infra`,
plus the cross-cutting `ci`, `deps`, `adr`, `release`). That scope is exactly
the signal needed to route a commit to the release train it actually
belongs to.

## Decision Drivers

- **A commit only releases the artifact it changed.** Web-only commits must
  not appear in the CLI's changelog or version, and vice versa.
- **No new dependency for something the commit history already encodes.**
  The scope is already there and already enforced; use it rather than add a
  git-diff-based monorepo plugin.
- **No race between two processes pushing to the same branch.** Whatever
  runs the two trains must not have them both push a release commit to main
  concurrently.
- **Minimal change to what already works.** ADR-0006's gate-then-release-
  then-deploy shape, and ADR-0008's exec-script replacement for
  `@semantic-release/npm`, both stay exactly as they are for the CLI train.

## Considered Options

### Option 1: A monorepo-aware semantic-release plugin (e.g. `semantic-release-monorepo`)

Wraps each step to filter `context.commits` to the ones whose changed files
fall under a package's directory, computed via a git diff per commit.

- **Pros**: Works without commit scopes; the de facto standard for this
  problem in the semantic-release ecosystem.
- **Cons**: Another dependency to keep patched (rule 5), largely unmaintained
  upstream, and does a git diff per commit for information this repository's
  commit scope already gives for free. `core` is used by both packages, and
  path-based filtering can't express "this commit affects both trains" as
  directly as a scope allow-list can.

### Option 2: Filter commits by their commitlint scope, in a small local plugin

Wrap `@semantic-release/commit-analyzer` and
`@semantic-release/release-notes-generator` with a local module
(`scripts/scoped-release-plugins.mjs`) that drops commits scoped to a
*different* package before delegating to the real plugin. A commit with no
scope, or a cross-cutting scope (`ci`, `deps`, `adr`, `release`), counts
toward every train; `core` counts toward both the CLI and web trains, since
both bundle or call into it.

- **Pros**: No new dependency; reuses a rule already enforced at commit time;
  ~70 lines, readable, sits next to the other release scripts. Continues the
  pattern ADR-0008 already established of replacing an official plugin's
  behaviour with a small local script where the official one doesn't fit.
- **Cons**: Coupled to the exact commitlint scope enum; adding a package
  means updating both `commitlint.config.mjs` and this filter's scope lists.
  A commit that forgets its scope, or scopes something incorrectly, silently
  releases on every train that permits unscoped commits, rather than
  raising an error.

### Option 3: One release, two prepare/publish steps for both artifacts

Keep a single semantic-release run and version number; run the CLI's
prepare/publish and the web's prepare only when their respective paths
changed (e.g. via `git diff --name-only` in `prepareCmd`).

- **Pros**: No plugin wrapping, no `--extends` resolution surprises.
- **Cons**: Doesn't fix the actual problem - the CLI's version, changelog,
  and eventual npm release notes would still bump and mention web-only
  changes, since the version number and CHANGELOG.md stay shared. Rejected:
  it decouples deployment steps but not the thing that was asked to be
  separated - the releases themselves.

## Decision

**Option 2.** Two independent semantic-release configurations,
`release.cli.config.mjs` and `release.web.config.mjs`, each invoked with
`--extends` (there is no single default-named config anymore). Both wrap the
same two plugins through `scripts/scoped-release-plugins.mjs`:

| Train | Own scopes            | Tag format       | Assets                                    |
| ----- | ---------------------- | ----------------- | ------------------------------------------ |
| CLI   | `cli`, `core`           | `v${version}` (unchanged) | `CHANGELOG.md`, `packages/cli/package.json` |
| Web   | `web`, `infra`, `core`  | `web-v${version}` | `packages/web/CHANGELOG.md`, `packages/web/package.json` |

A commit belongs to a train if its scope is one of that train's own scopes,
if it has no scope at all, or if its scope is cross-cutting (`ci`, `deps`,
`adr`, `release`) - i.e. it is excluded only when it names a *specific
other* package. `core` belongs to both, since it is bundled into the CLI and
called directly by the web adapter. The CLI keeps its existing tag format and
`CHANGELOG.md` so its 15 existing releases and tags are undisturbed; the web
train starts fresh at `1.0.0` under a distinct tag prefix.

`scripts/release-web.ts` mirrors `scripts/release-cli.ts` (ADR-0008): it
writes the version into `packages/web/package.json` and rebuilds the Lambda
bundle to prove the version-bumped commit still builds, but has no publish
step - the web app isn't published to a registry, `deploy` in
`.github/workflows/main.yml` is what ships it.

`main.yml` runs `release-cli` then `release-web` **sequentially**
(`release-web` needs `release-cli`), not in parallel: `@semantic-release/git`
pushes a commit for each train that releases, and two semantic-release
processes pushing to main at the same time would race. `deploy` now depends
on `release-web` specifically, not `release-cli` - it promotes the web app,
so it should follow the web train, not wait on an unrelated CLI publish.

`--extends` changes how semantic-release resolves bare plugin names: it
resolves them relative to the extended config's directory (this repository),
not semantic-release's own install directory, so a plugin that used to work
as an implicit default (`@semantic-release/github`) stopped resolving the
moment `--extends` was introduced. `@semantic-release/commit-analyzer`,
`@semantic-release/release-notes-generator` and `@semantic-release/github`
are now explicit `devDependencies` for that reason, alongside `changelog`,
`exec` and `git`, which already were.

## Consequences

### Positive

- A web-only commit no longer bumps the CLI's version or appears in its
  changelog, and a CLI-only commit no longer bumps the web app's version.
  `core` and cross-cutting commits (ci/deps/adr/release/unscoped) still count
  toward both, which matches their actual blast radius.
- `deploy` now depends on the release step that actually concerns it
  (`release-web`), and its job no longer needs `id-token: write` for npm,
  since nothing npm-related happens in that train.
- The filter is ~70 lines with no new runtime dependency, verified directly
  against synthetic commits (feat(web) → null on the CLI train, feat(cli) →
  null on the web train, core/cross-cutting → counted on both) rather than
  through git diffs.

### Negative

- Two release jobs instead of one adds a little pipeline latency (they run
  sequentially, not in parallel) and doubles the semantic-release
  boilerplate in `main.yml`.
- The filter trusts the commitlint scope literally; an incorrectly scoped
  commit (or one that skips `--no-verify`) is not caught by this filter and
  will release on whichever train's rules happen to match it.
- `@semantic-release/github`'s `success`/`fail` steps are not scope-filtered
  (only `analyzeCommits`/`generateNotes` are), so a push that releases on
  both trains in the same run can comment on a referenced GitHub issue
  twice, once per train. Accepted: cosmetic, and only on the rare push that
  releases both at once.

### Risks and mitigations

- *Risk*: A future package is added but its scope is missed in
  `scripts/scoped-release-plugins.mjs`'s `PACKAGE_SCOPES`, silently making
  every commit against it cross-cutting (counted by every train).
  *Mitigation*: `PACKAGE_SCOPES` and `commitlint.config.mjs`'s scope-enum are
  next to each other in intent; keep them in sync when either changes.
- *Risk*: Running two semantic-release processes in the same workflow run,
  even sequentially, is more moving parts than one. *Mitigation*: strict
  `needs:` ordering with a fresh checkout per job means `release-web` always
  starts from whatever `release-cli` already pushed - never runs against a
  stale HEAD.
