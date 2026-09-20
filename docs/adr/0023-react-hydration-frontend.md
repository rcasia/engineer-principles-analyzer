# ADR-0023: Migrate the web UI to React with selective hydration

**Status**: Accepted — Phase 1 (#49), Phase 2 (#50) and Phase 3 (#51) all
landed; supersedes [ADR-0004](0004-server-rendered-web-without-client-javascript.md).
**Date**: 2026-09-20

## Context

ADR-0004 decided the web UI would be server-rendered HTML from pure
functions with zero client-side JavaScript. That decision was correct for
its context: the UI's job was to show a list, and the drivers were
accessibility-by-default, near-zero hosting cost, and keeping rendering
inside the mutation-testing gate without a browser.

The context has since moved. The `/analyze` route is now a developer
playground (ADR-0015, `analyze-page.ts`): an editor with a line-number
gutter, language/file toolbar, example pre-filling, and validation-error
echo. Several of its current behaviours are static workarounds for having
no client script at all — the gutter "cannot track typing, which is why
[it] describe[s] the loaded buffer rather than pretend[s] to be live",
example selection is a full-page reload per click, and validation feedback
requires a server round-trip. These are accepted gaps in ADR-0015, but they
are gaps in exactly the place where interactivity has the most value: the
moment a visitor is deciding whether to trust the tool with their code.

This ADR proposes superseding ADR-0004 with React, server-rendered, with
selective hydration for the interactive parts. It is **Proposed, not
Accepted**: the migration is explicitly *not* approved work until the
Phase 1 spike answers the two questions below. Landing this ADR records
the direction and the plan; flipping it to Accepted happens only with the
spike's evidence, as its own commit.

## Decision Drivers

- **Interactivity where it pays.** Live gutter/line-count, client-side
  validation echo, example switching without reload — all confined to the
  `/analyze` playground today. The principles list and design playground
  gain nothing from hydration and should be migrated last, if at all.
- **The mutation gate applies to the UI too** (ADR-0003, ADR-0004). Any
  framework choice must come with a story for how interactive client code
  reaches the 95% bar. Stryker's configured runner is `bun test` with no
  DOM — there is currently no browser/jsdom runner at all. A migration
  without a client-side mutation story silently exempts the most
  failure-prone code from the repo's strongest gate.
- **Accessibility is proven by tests, not by framework.** ADR-0004's
  baseline (landmarks, focus, reduced-motion, both colour schemes) is
  asserted per page. React makes `div`-soup easy; the baseline must be
  re-proven per migrated page, not assumed from "React is accessible".
- **Cost model.** ADR-0005/ADR-0009 keep the CDN in front of Lambda with
  aggressive caching of static responses. Client JS is a new artifact
  class: built, hashed, cache-busted, and served with long-lived immutable
  caching — plus a build step in CI. `ANALYSIS_CACHE_CONTROL: no-store`
  responses cannot be pre-hydrated at the edge the way cacheable pages
  can; hydration must degrade to plain SSR HTML when the script fails or
  is disabled.
- **Few moving parts** (ADR-0001). A bundler, a client test runner, and a
  hydration story are three new moving parts. The phase plan below exists
  so each one justifies itself before the next is added.

## Considered Options

### Option 1: Stay the course — no framework, improve the string templates

Keep ADR-0004 as-is; invest in small template helpers instead.

- **Pros**: Zero new toolchain; mutation story unchanged; no cost-model
  impact; no hydration failure modes.
- **Cons**: Every interactive behaviour stays a static workaround. The
  gutter, validation echo, and example switching do not get better with
  more template code — they are structurally limited by having no client
  script. Rejects the explicit product request for a more capable
  playground.

### Option 2: React (or JSX) as a server templating engine only, still zero client JS

Render the same pages with components, but ship no script to the browser.

- **Pros**: Component composition for the sprawling templates ADR-0004
  already flagged; keeps every zero-JS guarantee (cost, a11y baseline,
  no hydration bugs); `renderToString` output is still assertable as a
  pure function under `bun test`.
- **Cons**: Pays most of the migration cost (toolchain, rewrite, test
  churn) for none of the interactivity. As an end state it is the worst
  trade available — but as a *transit* state inside the phase plan, it is
  exactly how each page should land before its hydration is added.

### Option 3: React SSR with selective hydration, in phases (proposed)

Server-render everything as today; hydrate only the `/analyze`
playground's interactive islands (editor gutter, validation echo,
example switching), with plain-SSR degradation when JS is absent.
Principles list and design playground migrate as SSR-only components
(Option 2) and are hydrated only if a concrete need appears.

- **Pros**: Interactivity where it pays, nowhere else; every page remains
  fully usable with scripting disabled (the current baseline, preserved);
  each phase is independently shippable and reverts cleanly to SSR.
- **Cons**: All of Option 2's migration cost, plus a bundler, a client
  test runner with a real mutation story, hydration-mismatch failure modes,
  larger CDN payloads on analysis pages, and CI time. The client-side
  mutation story is currently *unsolved* — Phase 1 must solve it before
  Phase 2 begins, or the gate develops a hole exactly where bugs hurt most.

### Option 4: Full single-page app

Client-rendered React app calling a JSON API.

- **Pros**: Maximum interactivity; familiar shape.
- **Cons**: Destroys everything ADR-0004/ADR-0015 bought: no-JS access,
  edge-cacheable HTML, `no-store` semantics per response, server-side
  validation as the single path. Requires an API-first redesign of the
  Lambda surface and a new auth/abuse story for a public JSON endpoint.
  Rejected outright — it answers a different product's needs.

## Decision

Propose **Option 3**, executed in phases, each gated on the previous
phase's evidence. **No code migrates under this ADR** — it records intent
and acceptance bars only:

- **Phase 1 — toolchain spike + SSR-only migration of one page.**
  Add the build step (bundler, hashed client assets, immutable CDN
  caching), migrate the *principles list* (lowest risk, no forms) to
  SSR-only components, and — the actual gate — stand up the client-side
  test runner **with a mutation-testing story that holds 95%** on client
  code, plus the ADR-0004 accessibility baseline re-proven for the
  migrated page. If the mutation story does not hold, the migration stops
  here and this ADR is marked Deprecated, not Accepted.
- **Phase 2 — hydrate the `/analyze` playground.**
  Only after Phase 1 is Accepted: hydrate editor gutter, client-side
  validation echo, and example switching as isolated islands; prove
  no-JS degradation (same HTML, same validation, server round-trip);
  prove hydration-mismatch handling; revisit ADR-0005/ADR-0009 cache
  behaviour for the new assets with measured payload sizes.
- **Phase 3 — remaining pages, retire the string templates.**
  Migrate the design playground (SSR-only unless a need is shown), delete
  the old template modules, and update the mutation config so the old
  exclusions do not silently widen.

Each phase lands as its own atomic commits plus an ADR status update; this
ADR flips from Proposed to Accepted only when Phase 1's evidence exists,
and supersedes ADR-0004 only when Phase 3 completes (until then ADR-0004
remains in force for every unmigrated page).

## Consequences

### Positive

- The playground stops pretending static HTML is an editor: live gutter,
  instant validation echo, reload-free examples — while remaining fully
  functional without JS, which keeps the accessibility and resilience
  baseline, not just the appearance of one.
- Component boundaries give the sprawling templates the composition story
  ADR-0004 admitted they lack.
- The phased gates make the migration cancellable at every step with the
  trunk still green — consistent with trunk-based delivery (ADR-0006).

### Negative

- Three new moving parts (bundler, client test runner, hydration) against
  ADR-0001's grain; CI gets slower; the CDN story gains an asset class
  that must be versioned and cache-busted correctly.
- Every existing page test is rewritten at least once; the string-template
  tests and the component tests coexist during the migration, roughly
  doubling UI test surface until Phase 3 deletes the old ones.
- Client bundle size becomes a standing cost on analysis pages — the very
  pages served `no-store` — paid on every visit that runs the script.

### Risks and mitigations

- *Risk*: The client-side 95% mutation story proves impractical (no DOM
  runner, browser-based Stryker too slow/flaky for CI).
  *Mitigation*: this is Phase 1's explicit go/no-go criterion. If it
  fails, the ADR is Deprecated and the templates stay — a cheap, early
  finding, which is the point of phasing.
- *Risk*: Hydration mismatches (server HTML vs client render) cause
  visible flicker or, worse, silently wrong editor state.
  *Mitigation*: islands are small and self-contained; mismatch handling is
  Phase 2 acceptance criteria, proven by test, not by review.
- *Risk*: Accessibility regresses through `div`-based components while
  "React handles it" goes unchallenged.
  *Mitigation*: the ADR-0004 baseline assertions are ported per page in
  Phase 1/2 and must pass before the old template is deleted.
- *Risk*: The JS bundle degrades the Lambda/CloudFront cost model
  (payload size, cache behaviour, cold starts serving larger responses).
  *Mitigation*: measured sizes and cache-hit impact are Phase 2 evidence;
  ADR-0005/ADR-0009 get explicit amendments if the numbers move.
- *Risk*: A half-migrated UI (some pages components, some templates)
  lingers indefinitely.
  *Mitigation*: Phase 3 has the same standing as the other phases —
  tracked follow-up issues, not aspirations. If it stalls, a follow-up
  decision explicitly blesses the hybrid state or kills it.

## Related

- ADR-0004 (in force until Phase 3 completes; then superseded by this ADR).
- ADR-0015 (the analyze workflow whose accepted gaps motivate hydration).
- ADR-0003 (the mutation gate the client story must satisfy),
  ADR-0001 (few moving parts — the cost this migration pays against).
- ADR-0005 / ADR-0009 (hosting and CDN assumptions Phase 2 must re-measure).
- #28 (no new person-level data in client telemetry — the CLI precedent is
  no telemetry by default; any client analytics needs its own basis).
