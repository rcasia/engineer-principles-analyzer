# principled

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

Once published, the CLI needs only Node 20+:

```sh
npx principled             # list the known principles
npx principled --help
```

It is not on npm yet — see [ADR-0008](docs/adr/0008-publish-the-cli-to-npm.md)
for why, and how to switch it on.

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
docs/design/     product design language and interaction standards
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
| `bun run cli`               | Run the CLI from source                             |
| `bun run build:cli`         | Bundle the CLI for npm                              |
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
- **CLI package** — the npm tarball is packed, installed into a clean
  directory with npm and Node, and the binary is run. Proves it works without
  Bun.
- **Terraform** — formatted, valid, and actually applied to LocalStack, with
  the deployed function checked over HTTP. The CloudFront layer is the one
  exception: LocalStack Community cannot emulate it, so it is validated in CI
  and verified end to end on real deploys.

None of the gates need secrets, so they run on forks and pull requests from
anyone.

Git hooks run the fast subset locally. They are installed automatically by
`bun install`.

## How changes reach production

Commits go straight to main. If the gates pass, semantic-release derives the
version from the commit messages, tags it and writes the changelog; the commit
is then deployed. There is no review step — the gates are the safety net.

Publishing the CLI to npm is skipped until `NPM_PUBLISH` is `true`; the
version is still bumped and the tarball still built and verified.
Authentication prefers npm's OIDC trusted publishing, falling back to
`NPM_TOKEN` for the one-time bootstrap publish a trusted publisher needs to
exist against (see [ADR-0010](docs/adr/0010-npm-trusted-publishing.md)).

Deployment is skipped until `AWS_DEPLOY_ROLE_ARN` is set as a repository
variable, so the pipeline is green without an AWS account. Turning it on is a
one-time setup documented in [`infra/bootstrap`](infra/bootstrap/README.md):
it creates the Terraform state bucket, the GitHub OIDC provider and the
deploy role.

## Global delivery and cost

CloudFront serves the site from ~600 edge locations, with one arm64 Lambda in
`eu-west-1` as the origin. Cached responses never reach the origin, so most
users skip the Lambda cold start entirely
([ADR-0009](docs/adr/0009-cloudfront-in-front-of-lambda.md)).

The Function URL is **not public**: origin access control means only the
CloudFront distribution can sign requests to it, so the cache cannot be
bypassed.

Idle cost is $0 and there is no always-on component. CloudFront's free tier
(1 TB egress and 10M requests per month) and Lambda's are both perpetual, and
origin fetches from AWS cost nothing. Log retention is capped at 7 days,
which is the main thing that could quietly spend money.

## Documentation

- [Architecture decision records](docs/adr/README.md) — the reasoning behind
  every choice here, including the downsides.
- [Product design](docs/design/README.md) — visual language, components, layout
  and UX standards.
- [Infrastructure](infra/README.md) — how to plan, apply and destroy.
- [AGENTS.md](AGENTS.md) — conventions for agents and humans working here.

## Licence

[Apache 2.0](LICENSE)
