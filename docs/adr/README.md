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
| [0004](0004-server-rendered-web-without-client-javascript.md) | Render the web UI on the server with no client-side JavaScript | Superseded by [0023](0023-react-hydration-frontend.md) | 2026-09-19 |
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
| [0016](0016-separate-cli-and-web-release-trains.md) | Split the CLI and web release trains by commit scope | Accepted; routing superseded by [0019](0019-route-release-trains-by-changed-files.md), ordering by [0020](0020-run-release-trains-in-parallel.md) | 2026-09-19 |
| [0017](0017-shared-secret-origin-instead-of-oac.md) | Protect the CloudFront origin with a shared secret header, not OAC | Superseded by [0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) | 2026-09-19 |
| [0018](0018-revert-to-oac-scp-blocks-public-function-urls.md) | Revert to origin access control — an Organization SCP blocks public Function URLs | Accepted; POST gap resolved by [0019](0019-sign-post-with-lambda-at-edge.md) | 2026-09-19 |
| [0019](0019-sign-post-with-lambda-at-edge.md) | Sign CloudFront origin requests with Lambda@Edge so POST works | Accepted | 2026-09-19 |
| [0019](0019-route-release-trains-by-changed-files.md) | Route release trains by changed files, not commit scope | Accepted | 2026-09-19 |
| [0020](0020-run-release-trains-in-parallel.md) | Run the release trains in parallel, retrying the push race | Accepted | 2026-09-19 |
| [0021](0021-incremental-mutation-testing-with-cache.md) | Cache Stryker incremental reports, forcing full runs on test changes | Accepted | 2026-09-20 |
| [0022](0022-srp-heuristic-rule.md) | Detect Single Responsibility violations with a dependency-free method-name heuristic | Accepted; language allow-list extended by [0031](0031-srp-java-python-extractors.md) | 2026-09-20 |
| [0023](0023-react-hydration-frontend.md) | Migrate the web UI to React with selective hydration | Accepted | 2026-09-20 |
| [0024](0024-jev-backed-srp-rule-adapter.md) | Judge SRP with a Jev-backed Rule adapter to validate the core | Accepted | 2026-09-20 |
| [0025](0025-language-detection.md) | Detect the submission language from filename and content | Superseded by [0026](0026-auto-detect-language-only.md) | 2026-09-20 |
| [0026](0026-auto-detect-language-only.md) | Auto-detect the submission language with no manual override | Superseded by [0028](0028-jev-language-detection.md) | 2026-09-20 |
| [0027](0027-detect-secrets-commit-hook.md) | Block new secrets with detect-secrets, at commit time and in CI | Accepted | 2026-09-20 |
| [0028](0028-jev-language-detection.md) | Detect the submission language with Jev Choice | Accepted; blocking behaviour superseded by [0040](0040-unknown-language-is-non-blocking.md) | 2026-09-20 |
| [0029](0029-live-highlighting-analyze-editor.md) | Live language detection and syntax highlighting on /analyze | Accepted | 2026-09-20 |
| [0030](0030-ocp-heuristic-rule.md) | Detect Open/Closed violations with a dependency-free branch-counting heuristic | Accepted | 2026-09-20 |
| [0031](0031-srp-java-python-extractors.md) | Support Java and Python in the SRP heuristic with per-language extractors | Accepted | 2026-09-20 |
| [0032](0032-lsp-heuristic-rule.md) | Detect Liskov violations with a dependency-free override-throw heuristic | Accepted | 2026-09-20 |
| [0033](0033-quality-views-as-projections.md) | Treat quality metrics, snapshots and exemplars as projections | Accepted | 2026-09-20 |
| [0034](0034-isp-heuristic-rule.md) | Detect Interface Segregation violations with a dependency-free member-count heuristic | Accepted | 2026-09-20 |
| [0035](0035-dip-heuristic-rule.md) | Detect Dependency Inversion violations with a dependency-free import-and-instantiation heuristic | Accepted | 2026-09-20 |
| [0036](0036-solid-judgment-corpus.md) | Judge the SOLID rules against a versioned synthetic corpus | Accepted | 2026-09-20 |
| [0037](0037-keyless-detection-degrades.md) | Serve keyless without failing the cold start | Accepted | 2026-09-20 |
| [0038](0038-mutation-advisory.md) | Mutation testing reports separately, never blocks delivery | Accepted | 2026-09-20 |
| [0039](0039-landing-page-and-shared-shell.md) | Serve a landing page at / and the catalog from /principles behind one shared shell | Accepted | 2026-09-20 |
| [0040](0040-unknown-language-is-non-blocking.md) | Run unknown languages as "unknown" instead of blocking | Accepted | 2026-09-23 |
| [0041](0041-custom-domain.md) | Serve the site from an optional custom domain | Accepted | 2026-09-23 |

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
