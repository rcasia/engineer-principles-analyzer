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
| [0005](0005-aws-lambda-function-url.md) | Deploy to AWS Lambda behind a Function URL, verified on LocalStack | Accepted | 2026-09-19 |

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
