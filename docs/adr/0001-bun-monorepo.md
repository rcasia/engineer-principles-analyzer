# ADR-0001: Use Bun as the runtime and a single monorepo

**Status**: Accepted
**Date**: 2026-09-19

## Context

The project starts from an empty repository and needs to host at least three
deliverables: a `core` library holding the analysis rules, a `cli`, and a `web`
UI. More packages are expected. We need a runtime, a package manager, a test
runner and a repository layout before any product code can be written.

The project is explicitly **agentic first**: most changes will be made by
automated agents. Every extra tool is another thing an agent must install,
configure and keep in sync, and another source of non-determinism.

## Decision Drivers

- **Few moving parts.** Every tool we avoid is a class of breakage removed.
- **Fast feedback.** Agents iterate in a loop; seconds matter.
- **Shared code without publishing.** `cli` and `web` must both consume `core`
  before anything is released.
- **Low cost by design.** Short CI runs are cheaper CI runs.

## Considered Options

### Option 1: Bun workspaces, single repository

- **Pros**: One binary is the runtime, package manager, bundler and test
  runner. Executes TypeScript directly, so no build step is needed to run or
  test. Workspaces resolve `@epa/core` from source with no publish step.
- **Cons**: Younger ecosystem; some Node-only tooling needs a Node fallback.

### Option 2: Node + pnpm workspaces + Vitest + tsx

- **Pros**: Most mature and widely documented combination.
- **Cons**: Four tools to install, version and align, plus a transpile step
  before tests can run. Slower cold start in CI.

### Option 3: Separate repository per deliverable

- **Pros**: Independent release cadence, clear ownership boundaries.
- **Cons**: Cross-cutting changes need coordinated PRs across repositories,
  which defeats the atomic-commit and "docs in the same commit" requirements.

## Decision

Use **Bun** as the runtime, package manager and test runner, and keep every
package in a **single repository** under `packages/*` using Bun workspaces.

TypeScript is compiled with `emitDeclarationOnly`: Bun runs the sources, so
`tsc` is used purely as a type checker and declaration emitter. This is why
`allowImportingTsExtensions` is enabled and imports carry explicit `.ts`
specifiers.

## Consequences

### Positive

- `bun install && bun test` is the entire onboarding path, for humans and
  agents alike.
- A change spanning `core` and `cli` is one atomic commit, which is what the
  delivery model requires.
- No build artefacts to run tests, so the test loop stays in the milliseconds.

### Negative

- Tooling that only ships for Node (currently the mutation testing runner, see
  ADR-0003) must be invoked through Node rather than Bun.
- Bun's API surface is still moving; upgrades may need more attention than a
  Node LTS bump.

### Risks and mitigations

- *Risk*: Bun becomes unsuitable and we need to move to Node.
  *Mitigation*: Nothing in `core` depends on Bun APIs; only the test files
  import `bun:test`. A move would be a test-harness migration, not a rewrite.
