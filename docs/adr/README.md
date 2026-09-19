# Architecture Decision Records

Significant technical decisions for this project, newest last.

An ADR is written **in the same commit as the change it justifies**. If a
commit changes how the system is built, its ADR ships with it.

## Index

| ADR                            | Title                                     | Status   | Date       |
| ------------------------------ | ----------------------------------------- | -------- | ---------- |
| [0001](0001-bun-monorepo.md)   | Use Bun as the runtime and a single monorepo | Accepted | 2026-09-19 |
| [0002](0002-hexagonal-architecture.md) | Organise code as vertical slices over a hexagon | Accepted | 2026-09-19 |
| [0003](0003-mutation-testing-gate.md) | Gate on mutation score, not line coverage | Accepted | 2026-09-19 |
| [0004](0004-server-rendered-web-without-client-javascript.md) | Render the web UI on the server with no client-side JavaScript | Accepted | 2026-09-19 |
| [0005](0005-aws-lambda-function-url.md) | Deploy to AWS Lambda behind a Function URL, verified on LocalStack | Partly superseded by [0009](0009-cloudfront-in-front-of-lambda.md) | 2026-09-19 |
| [0006](0006-trunk-based-delivery.md) | Push to main, gate with CI, release and deploy automatically | Accepted | 2026-09-19 |
| [0007](0007-remote-terraform-state.md) | Keep production state in S3, provisioned by a bootstrap module | Accepted | 2026-09-19 |
| [0008](0008-publish-the-cli-to-npm.md) | Publish the CLI to npm as `principled`, bundling core | Accepted | 2026-09-19 |
| [0009](0009-cloudfront-in-front-of-lambda.md) | Serve globally from CloudFront, with the origin locked to it | Accepted (OAC restored by [0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) after [0017](0017-shared-secret-origin-instead-of-oac.md)) | 2026-09-19 |
| [0010](0010-npm-trusted-publishing.md) | Publish the CLI to npm with OIDC trusted publishing | Accepted | 2026-09-19 |
| [0011](0011-dependency-vulnerability-audit-gate.md) | Gate on `bun audit`, at commit time, in CI, and on a schedule | Accepted | 2026-09-19 |
| [0012](0012-event-sourcing-and-cqrs.md) | Use Event Sourcing and CQRS for application state | Accepted | 2026-09-19 |
| [0013](0013-analysis-result-contract.md) | Define a single, validated `AnalysisResult` contract | Accepted | 2026-09-19 |
| [0014](0014-rule-evaluation-engine.md) | Build a fault-isolating rule evaluation engine, seeded with a fake ruleset | Accepted | 2026-09-19 |
| [0015](0015-single-file-web-analysis-workflow.md) | Analyze a single source file on the web without client JavaScript | Accepted | 2026-09-19 |
| [0016](0016-separate-cli-and-web-release-trains.md) | Split the CLI and web release trains by commit scope | Accepted | 2026-09-19 |
| [0017](0017-shared-secret-origin-instead-of-oac.md) | Protect the CloudFront origin with a shared secret header, not OAC | Superseded by [0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) | 2026-09-19 |
| [0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) | Revert to origin access control — an Organization SCP blocks public Function URLs | Accepted | 2026-09-19 |

## Writing a new ADR

1. Copy [`template.md`](template.md) to `NNNN-title-with-dashes.md`.
2. Fill it in. Be honest about the cons; an ADR with no downsides is an advert.
3. Add a row to the index above.
4. Commit it together with the change it describes.

## Status values

- **Proposed** — under discussion, not yet acted on.
- **Accepted** — decided and being implemented.
- **Deprecated** — no longer relevant, not replaced.
- **Superseded** — replaced by a later ADR, which must be linked.

Accepted ADRs are not edited to change a decision. Write a new ADR that
supersedes the old one, so the history of reasoning stays intact.
