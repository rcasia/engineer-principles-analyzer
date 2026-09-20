# ADR-0039: Serve a landing page at / and the catalog from /principles behind one shared shell

**Status**: Accepted
**Date**: 2026-09-20

## Context

Issue #52: a first-time visitor reached the deployed site and could not tell
what Principled is, what problem it solves, or how it relates to the tooling
they already use. The site had no landing page — `/` rendered the principles
catalog, which is empty while the catalog is drafted, under the product name
itself as `<h1>`. A visitor with no prior context arrived, saw an empty list
and left confused. Every page also copy-pasted its own top bar and footer, so
the identity and messaging could drift page to page — which is exactly the
failure mode #52 reports.

## Decision Drivers

- A visitor must understand the product before being asked to interact.
- ADR-0004/ADR-0023: pages are server-rendered, keyboard- and
  screen-reader-accessible, with JavaScript only as an enhancement.
- One `h1` and one identity per page (`docs/design/ux-principles.md`).
- Messaging must not be able to differ between pages by accident.
- Routes must stay cacheable by the CDN exactly as they are today.

## Considered Options

### Option 1: Expand `/` into a combined landing + catalog page

- **Pros**: no new routes; the catalog is "the product" arguably.
- **Cons**: one page cannot hold a product pitch and a data list with two
  honest empty states; the `h1` collision is unavoidable; the catalog's
  emptiness stays the first impression.

### Option 2: A separate client-side marketing site

- **Pros**: richer interactions for the pitch.
- **Cons**: contradicts ADR-0004/ADR-0023 for content that needs no
  interaction; a second deployment, second cache story and a second source
  of messaging drift — the problem being solved.

### Option 3: Static landing at `/`, catalog at `/principles`, shared shell

- **Pros**: each page has one job and one `h1`; the chrome exists once and
  nav identity cannot drift; both routes stay plain cacheable HTML.
- **Cons**: more routes to keep aligned; a new URL for existing catalog
  visitors; the design playground renders React, so it shares the nav data
  rather than the shell string.

## Decision

`presentation/layout.ts` owns the document shell — head, skip link, top bar
with a single `NAV_ITEMS` list, main landmark and footer — and renders every
string-template page through `renderPage()`. The landing page
(`renderLandingPage`) is served at `/`: it answers what Principled is, which
gap it fills next to compilers, linters and tests, how a finding is produced
(principles → semantic analysis → evidence + judgment → actionable finding)
and leads directly into `/analyze`. The principles catalog moves to
`/principles`. The design playground keeps its React shell but imports
`NAV_ITEMS`, so the navigation itself still has one source.

## Consequences

### Positive

- First-visit comprehension is the landing page's only job.
- Navigation, tagline and version are defined once; consistency across the
  site is structural, not aspirational.
- Landing and catalog are independently cacheable pages (`PAGE_CACHE_CONTROL`).

### Negative

- `/` is no longer a deep link to the catalog; bookmarks land on the pitch
  and must click through. Accepted: the pitch is the thing a bookmark of a
  product root should show.
- One more page means one more set of copy tests to keep honest, and a
  claim review on every copy change ("no unsupported claims" is an
  acceptance criterion of #52, not a one-time gate).
- The design playground duplicates the shell markup (React vs string
  templates); only its nav data is shared, so the two shells can still
  drift in styling or attributes despite `NAV_ITEMS`.

### Risks and mitigations

- Copy drifts into claims the product cannot support (repository-level
  analysis, accuracy). Mitigated by asserting the landing copy verbatim in
  `landing-page.test.ts` and by pinning the "single files / never stored"
  facts there; changes to that copy must pass a literal-string test.
