# ADR-0008: Publish the CLI to npm as `principled`, bundling core

**Status**: Accepted
**Date**: 2026-09-19

## Context

The CLI is the only artefact a person can install. As written it could not be
published at all:

- every package was `private: true`
- `bin` pointed at `src/bin.ts` with a `#!/usr/bin/env bun` shebang, so
  `npx` would fail for anyone without Bun
- it depended on `@epa/core` with `workspace:*`, which npm cannot resolve
- there was no `files` allowlist, so tests and tsconfig would ship
- nothing bumped the version, which was pinned at `0.0.0`

The domain is still a stub: the CLI prints that the catalog is empty. So the
question is not only *how* to publish, but *whether* to yet.

## Decision Drivers

- **Installing must be obvious.** `npx <thing>` should be the whole story.
- **Bun is our choice, not the user's.** Requiring it to run the CLI would
  export an internal decision onto everyone.
- **npm names are permanent.** Unpublish is blocked after 72 hours and a
  released name can never be reused.
- **The publish path must be exercised**, or it rots until the day it is
  needed.

## Considered Options

### Name

`principles` and `principle` are both taken. Of what remains, **`principled`**
is a single real word, needs no hyphen, is unlikely to be mistyped, and
happens to describe the output: how principled the code is.

Package name and binary name are **the same string**, as with `eslint`,
`prettier` and `vite`, so `npx principled` and `principled` are identical.
`@epa/cli` was rejected: scope ownership was unverified and a scoped name is
worse to type and to discover. `epa-cli` was rejected as meaningless to
anyone who has not read this repository.

### Distributing core

**Option A: bundle `@epa/core` into the CLI.** One published package, no
`workspace:` protocol, no runtime dependencies.

**Option B: publish `@epa/core` alongside.** Makes core reusable, but commits
us to semver on `Score`, `PrincipleCatalog` and `ListPrinciples` — interfaces
that exist to be replaced once real principles are designed. Also needs
multi-package release tooling.

### Runtime

**Option A: bundle for Node with a `#!/usr/bin/env node` shebang.** Widest
reach, and reuses the machinery already proven for the Lambda bundle.

**Option B: ship TypeScript and require Bun.** Zero build step, but excludes
most users.

**Option C: `bun build --compile` standalone binaries.** Fast and dependency
free, but ~50MB per platform and not an npm distribution model.

### When to publish

**Option A: wire everything, publish behind a switch.** The tarball is built
and verified on every push; publishing needs one variable set.

**Option B: publish now.** Permanently claims the name, and ships something
that does nothing useful.

**Option C: leave it until the domain exists.** The publish path would be
written under pressure, on the day it first matters.

## Decision

Publish as **`principled`**, with the binary also named `principled`.

`@epa/core` is **bundled** into `dist/cli.mjs`, so the published package has
**no runtime dependencies**. It stays a devDependency of the CLI, ranged `*`
rather than `workspace:*`, because npm does not rewrite the workspace
protocol when packing from a package directory and it would otherwise reach
the registry verbatim.

The bundle targets **Node** (`#!/usr/bin/env node`). Bun is the bundler only.

Publishing is **switched off**: `release.config.mjs` reads `NPM_PUBLISH`, the
same pattern as `AWS_DEPLOY_ROLE_ARN` for deployment (ADR-0007). Until it is
`"true"`, semantic-release still writes the version into
`packages/cli/package.json`, still builds the bundle and still verifies the
tarball. Only the upload is skipped.

The version is stamped into the bundle by replacing a placeholder exported
from `version.ts`, and the build **fails** if the placeholder is missing, so
`--version` cannot silently drift from the release.

A `cli-package` CI gate packs the tarball, installs it into a clean directory
**with npm and Node**, and runs the binary: default output, `--version`,
`--help`, and exit code 2 for an unknown option. It also asserts the tarball
ships no sources, tests or type declarations, and that the package pulls in
no dependencies.

`--help` and `--version` were added because a published CLI without them is
not finished.

## Consequences

### Positive

- `npx principled` works on any machine with Node 20+, with nothing else
  installed and nothing to configure.
- Zero dependencies means a fast install and no transitive supply chain.
- The publish path runs on every push, so it cannot rot unnoticed. It already
  caught a real bug: Bun preserves the entry shebang, so the configured
  `banner` produced a **second** `#!` line, which is a syntax error in Node.
  The gate failed; a human would probably not have run the tarball.
- Core keeps no public API commitments while the domain is a stub.

### Negative

- Bundling means consumers cannot reuse `@epa/core` as a library. That is a
  deliberate deferral, and reversing it later means publishing a second
  package, not a rewrite.
- The version placeholder is a string replacement in a built artefact. It is
  guarded by a build-time assertion and a test, but it is still a seam
  between source and bundle.
- Release configuration is now JavaScript rather than JSON, so it is code
  that can misbehave. It is exercised on every release.
- `@epa/core: "*"` in devDependencies would resolve from the registry rather
  than the workspace under plain npm. The repository uses Bun exclusively
  (ADR-0001), so this only bites someone who changes package manager.

### Risks and mitigations

- *Risk*: npm rejects `principled` as too similar to the existing
  `principle` / `principles` packages. Its similarity check runs server side
  at publish, so it cannot be verified in advance.
  *Mitigation*: nothing is published yet, so discovering this costs a rename
  of one `name` field. `eng-principles` and `principles-cli` are both free as
  fallbacks.
- *Risk*: the name is claimed by someone else before we publish.
  *Mitigation*: accepted. Claiming a name for a tool that does nothing is the
  worse trade.
- *Risk*: `NPM_TOKEN` is a long-lived secret, unlike the OIDC used for AWS.
  *Mitigation*: npm supports trusted publishing with GitHub OIDC and
  provenance; `publishConfig.provenance` is already set. Moving to it is a
  follow-up once semantic-release supports tokenless publishing, and the
  token stays unset until then.
