# engineer-principles-analyzer

Analyzes subjects against engineering principles.

> **Status: scaffolding.** The delivery pipeline, architecture and quality
> gates are in place and verified. The domain is deliberately a stub — the
> catalog of principles and the analysis rules are not decided yet, and the
> shipped catalog is empty. See [ADR-0002](docs/adr/0002-hexagonal-architecture.md).

## Quick start

Requires [Bun](https://bun.sh) 1.3+. Nothing else is needed to run the tests.

```sh
bun install
bun run check      # typecheck + tests
bun run cli        # print the known principles
```

Run the web UI locally:

```sh
bun --hot packages/web/src/bin.ts   # http://localhost:3000
```

## Layout

```
packages/core/   domain and application layers; no I/O
packages/cli/    command line adapter
packages/web/    http adapter, server rendered, no client JavaScript
infra/           terraform: one lambda behind a function url
scripts/         build and verification scripts
docs/adr/        why things are the way they are
```

`core` is organised as vertical slices, each internally ports and adapters.
`cli` and `web` are driving adapters over it and hold no rules of their own.

## Scripts

| Command                     | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `bun run check`             | Typecheck and run the test suite                    |
| `bun test`                  | Run the test suite                                  |
| `bun run typecheck`         | Type check every package                            |
| `bun run test:mutation`     | Mutation testing; fails below 95%                   |
| `bun run cli`               | Run the CLI                                         |
| `bun run build:lambda`      | Bundle the web adapter for Lambda                   |
| `bun run infra:validate`    | `terraform validate`, no credentials needed         |
| `bun run localstack:up`     | Start LocalStack (needs Docker)                     |
| `bun run infra:apply:local` | Apply the stack to LocalStack                       |
| `bun run infra:destroy:local` | Tear the local stack down                         |

## Quality gates

Every push and pull request must pass all of these
([ADR-0006](docs/adr/0006-trunk-based-delivery.md)):

- **Conventional commits** — enforced by commitlint, locally and in CI.
- **Typecheck and tests** — strict TypeScript, `bun test`.
- **Mutation score ≥ 95%** — currently **100%** (107 mutants, 107 killed).
  Line coverage is not used as a gate; it measures the wrong thing
  ([ADR-0003](docs/adr/0003-mutation-testing-gate.md)).
- **Lambda bundle smoke test** — the built bundle is invoked under Node, the
  way AWS will invoke it.
- **Terraform** — formatted, valid, and actually applied to LocalStack, with
  the deployed function checked over HTTP.

None of the gates need secrets, so they run on forks and pull requests from
anyone.

Git hooks run the fast subset locally. They are installed automatically by
`bun install`.

## How changes reach production

Commits go straight to main. If the gates pass, semantic-release derives the
version from the commit messages, tags it and writes the changelog; the commit
is then deployed. There is no review step — the gates are the safety net.

Deployment is skipped until `AWS_DEPLOY_ROLE_ARN` is set as a repository
variable, so the pipeline is green without an AWS account.

## Cost

One arm64 Lambda behind a Function URL, nothing else. Lambda's free tier is
perpetual and there is no always-on component, so idle cost is $0. Log
retention is capped at 7 days, which is the only part that can quietly spend
money ([ADR-0005](docs/adr/0005-aws-lambda-function-url.md)).

## Documentation

- [Architecture decision records](docs/adr/README.md) — the reasoning behind
  every choice here, including the downsides.
- [Infrastructure](infra/README.md) — how to plan, apply and destroy.
- [AGENTS.md](AGENTS.md) — conventions for agents and humans working here.

## Licence

[Apache 2.0](LICENSE)
