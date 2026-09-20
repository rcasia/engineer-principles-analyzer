# ADR-0037: Serve keyless without failing the cold start

**Status**: Accepted
**Date**: 2026-09-20

## Context

ADR-0028 replaced heuristic language detection with a Jev Choice judgment
and made both composition roots fail fast without `TYPESAFE_API_KEY`. It
noted "Lambda has no `TYPESAFE_API_KEY` yet" as a known gap. That gap has
since bitten twice:

- The web Lambda has no `environment` block in `infra/main.tf`, so there
  was not even a channel for the key. Every deploy without one crash-loops:
  the import-time throw 502s all routes, including pages that need no
  detection.
- The LocalStack gate runs with no secrets by design, so it can never
  provide a real key — and `scripts/check-deployed.ts` POSTs `/analyze`
  expecting 200, which needs a live judgment.

Meanwhile `bun run build:lambda` in the lambda-bundle gate failed on its
own: the handler zip embeds the client bundles (ADR-0029), but the job
never built them first, so the client directory did not exist.

## Decision Drivers

- A missing credential must degrade one feature, never the whole function.
- The LocalStack gate works on a public repository with no secrets at all;
  that property stays.
- The deployed-stack check must still prove a POST body reaches the
  handler through the edge signer.
- Jev stays the only detector (ADR-0028 stands); no heuristic returns.

## Considered Options

### Option 1: Fail fast everywhere, provide the key in CI (rejected)

- **Pros**: One behavior; the gate exercises the live judgment.
- **Cons**: Needs a secret the public gate deliberately does not have;
  fork pull requests would go red with no way to fix them.

### Option 2: Heuristic fallback without a key (rejected)

- **Pros**: Deploy-time checks see 200 everywhere.
- **Cons**: Resurrects the detector ADR-0028 deleted, with the same two
  code paths and precedence question; rejected there for good reasons.

### Option 3: Start keyless, report submissions as undetectable (chosen)

- **Pros**: No second detector; the handler's existing undetected-language
  400 already covers the outcome, and its guidance tells the visitor what
  to do. Pages serve; only analysis degrades.
- **Cons**: A misconfigured production serves 400s on `/analyze` instead
  of crashing loudly — quieter, so the deploy must make the key easy to
  set (a sensitive `typesafe_api_key` variable, null by default).

## Decision

- `packages/web/src/language-detector.ts` (`detectorFor`): with a
  non-blank key, the Jev detector; without one, a detector that resolves
  every submission to `undefined`. `lambda-entry.ts` uses it and never
  throws for a missing key. `bin.ts` keeps the fail-fast: an operator
  starting a server sees the missing credential immediately on stderr.
- Infra gains a sensitive nullable `typesafe_api_key` variable wired to
  `TYPESAFE_API_KEY` on the web Lambda via a dynamic `environment` block.
  Production sets it; LocalStack and CI stay keyless.
- `scripts/check-deployed.ts` accepts the keyless outcome: 200 as before,
  or 400 carrying exactly the undetected-language guidance. A 400 from the
  handler still proves the POST body travelled through the signer — a
  signing failure is a 403 — so the edge-signer regression cover survives.
- The lambda-bundle gate builds the client before the handler, the same
  order as the `infra:*:local` scripts.

## Consequences

### Positive

- The function always starts; credential trouble is a scoped 400 with
  visitor guidance, not a 502 on every route.
- The no-secrets LocalStack gate is green without weakening what it
  proves about POST bodies.

### Negative

- Keyless production would 400 every analysis instead of failing loudly
  at deploy; operators must set `typesafe_api_key` (README documents it).
- The deploy check now has two accepted POST outcomes; a reviewer must
  read which one fired (the script logs it).

### Risks and mitigations

- **Nobody notices production is keyless**: mitigated by the infra
  variable documentation and by the guidance message itself; a metrics
  alert on analysis-failure rate is future work with #31.
- **Drift between `bin.ts` (fail-fast) and Lambda (degrade)**:
  deliberate and commented at both sites; revisit if it confuses.
