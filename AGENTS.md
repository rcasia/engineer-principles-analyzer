# AGENTS.md

Conventions for anyone changing this repository, human or agent. This project
is agentic first: assume the next contributor is a model with no memory of
this conversation.

## The loop

```sh
bun install          # also installs the git hooks
bun run check        # typecheck + tests, run this constantly
bun run test:mutation # before pushing anything that changes behaviour
bun run audit        # dependency vulnerabilities; the hook runs this for you
                      # whenever package.json or bun.lock changes (ADR-0011)
```

If `bun run check` is red, nothing else matters. Fix that first.

## Non-negotiables

1. **Commits are conventional and atomic.** One reason to change per commit.
   If the subject needs an "and", it is two commits. `commitlint` enforces the
   format; only you can enforce the atomicity.

   Atomic means the **smallest commit that is safe to push to `main` on its
   own** — it leaves the trunk green (`bun run check` passes) and does not
   break production. Split work down to that boundary, but never below it: a
   commit that would break the build or prod on its own is too small, even if
   it is "one reason". If a change only makes sense together with another to
   keep the trunk deployable, they are one commit.

   Allowed scopes: `core`, `cli`, `web`, `infra`, `ci`, `deps`, `adr`,
   `release`.

   Agents add a `model:` trailer to the footer naming the exact model that
   authored the commit, e.g. `model: claude-sonnet-5`. This is audit-only —
   it does not change review or authorship — so use the literal model ID,
   not a vendor or product name. Humans do not add this trailer.

2. **Documentation ships in the same commit as the change.** A commit that
   changes behaviour updates the docs that describe it. A commit that makes an
   architectural decision carries its ADR.

3. **Mutation score stays at or above 95%.** A surviving mutant is a missing
   test, not a statistic. Read what the mutant did and write the test that
   would have caught it. Do not raise the threshold's exemption list to go
   green.

4. **The domain has no I/O.** `packages/core/src/*/domain/` imports nothing
   from `application/` or `infrastructure/`. Dependencies point inward, always.

5. **Dependencies stay free of known vulnerabilities.** `bun run audit` runs
   on every commit that touches `package.json` or `bun.lock`, on every push
   and pull request, and weekly against `main` (ADR-0011). Fix a finding with
   an upstream update or a `package.json` override — never `--ignore` unless
   no fix exists yet.

6. **Never commit secrets, state or build output.** `.gitignore` covers
   `*.tfstate`, `*.tfvars`, `infra/build/` and `.env`. Check `git status`
   before staging.

7. **Done means pushed to `main`.** The trunk is the delivery target: once
   `bun run check` is green, commit and push. If `origin/main` moved while
   you worked, `git pull --rebase` first. A commit left on a local branch is
   not delivered work.

8. **Edit code in a worktree, not the shared checkout.** Agents run
   concurrently against this repository; editing the primary checkout
   directly risks mixing your changes with another agent's in-flight work.
   Before touching code, run `git worktree add ../principled-<task> -b <branch>`,
   do the work there, push from it, and `git worktree remove` it once the
   branch has merged to `main`.

## Architecture in one paragraph

`core` holds the rules and knows nothing about the outside world. It is
organised as vertical slices (one directory per capability), and each slice is
internally ports and adapters: `domain/` for pure rules, `application/` for
ports and use cases, `infrastructure/` for adapters. `cli` and `web` are
driving adapters — they compose the hexagon and translate, and contain no
rules. Read [ADR-0002](docs/adr/0002-hexagonal-architecture.md) before adding
a package.

## Writing tests

Tests are written to kill mutants, which in practice means:

- Assert exact values, not truthiness. `toBe("...")`, not `toBeTruthy()`.
- Test boundaries, not just the happy path: `0`, `100`, `-1`, `101`, `NaN`.
- Assert literal strings, **not** the constant the code exports. Asserting
  `expect(x).toBe(MESSAGE)` lets a mutant change both sides and survive.
- Prefer a real in-memory adapter over a mock, so the port itself is exercised.

## Adding a package

1. `packages/<name>/package.json`, `type: module`, `exports` pointing at
   `./src/index.ts`.
2. `tsconfig.json` extending `../../tsconfig.base.json`, with `references` to
   any workspace dependency.
3. Add it to `references` in the root `tsconfig.json`.
4. Depend on workspace packages with `"@principled/core": "*"`, **not**
   `"workspace:*"`. Bun links the local package either way, but
   semantic-release shells out to `npm`, and npm fails on the workspace
   protocol anywhere in the tree (`EUNSUPPORTEDPROTOCOL`).

Imports use explicit `.ts` extensions — Bun runs the sources directly and
`tsc` only emits declarations ([ADR-0001](docs/adr/0001-bun-monorepo.md)).

## The published CLI

`packages/cli` is published to npm as **`principled`**, with `@principled/core`
bundled in, so the tarball has no runtime dependencies ([ADR-0008](docs/adr/0008-publish-the-cli-to-npm.md)).

- The bundle targets **Node**, not Bun. Do not use Bun-only APIs in
  `packages/cli` or anything it imports.
- `version.ts` exports the literal `0.0.0-dev`, which `scripts/build-cli.ts`
  replaces with the release version. The build fails if that literal moves.
- Anything added to `files` in `packages/cli/package.json` ships to users.
  `scripts/check-cli-package.ts` fails if sources, tests or declarations
  appear in the tarball.

## Composition roots

Files that only wire things together (`bin.ts`, `lambda-entry.ts`) are
excluded from mutation testing in `stryker.config.json`. Keep them trivial. If
logic appears in one, move it into a tested module instead of widening the
exclusion.

## Infrastructure

`infra/` targets LocalStack or real AWS from the same configuration. Always
verify locally before pushing:

```sh
bun run localstack:up
bun run infra:apply:local
bun scripts/check-deployed.ts
bun run infra:destroy:local
```

`terraform plan` needs no credentials. Run `terraform -chdir=infra fmt` before
committing; CI checks formatting.

Anything guarded by `local.use_cdn` only exists on real AWS. If you change
the CDN, `terraform validate` is the only automated check before deploy, so
read it carefully.

Do not run `terraform` directly inside `infra/`: the backend declared there is
**production**. Use the `infra:*:local` scripts, which select a local backend
via a generated override file (ADR-0007). Production setup is a one-time
manual step documented in `infra/bootstrap/README.md`.

## Decisions

Anything that constrains future work gets an ADR in `docs/adr/`, using
`template.md`, added to the index, committed alongside the change. Be explicit
about the downsides — an ADR that lists no costs has not been thought through.

Do not edit an accepted ADR to change its decision. Write a new one that
supersedes it.

## Known gaps

Honest list of what is not done, so nobody assumes otherwise:

- The principles catalog is empty and the analysis rules do not exist.
- Deployment has never run against real AWS — only LocalStack. `infra/bootstrap`
  is validated but has never been applied.
- `infra/bootstrap` keeps its own state locally, so it is not reproducible
  from a clone; recovery is by `terraform import`.
- No import-boundary lint rule enforces the dependency rule; it is convention
  today.
- No budget alarm or reserved concurrency on the Lambda.
- CloudFront and origin access control are not covered by the LocalStack
  gate; LocalStack Community cannot emulate CloudFront. They are validated in
  CI and verified by `scripts/check-deployed.ts` on real deploys only.
- The CLI is wired for npm but not published; `NPM_PUBLISH` is unset and the
  name `principled` is unclaimed. npm's similarity check against the existing
  `principle` package cannot be verified until the first publish.
- npm OIDC trusted publishing (ADR-0010) cannot be registered until after
  that first publish — npm requires the package to already exist. Until a
  maintainer completes that one-time step on npmjs.com, `NPM_TOKEN` is what
  actually authenticates any real publish.
