# ADR-0004: Render the web UI on the server with no client-side JavaScript

**Status**: Superseded by [ADR-0023](0023-react-hydration-frontend.md)
**Date**: 2026-09-19

## Context

The web package needs a UI that is accessible and pleasant from the first
commit, on a project whose other hard constraints are **low cost by design**
and **few moving parts** (ADR-0001).

The UI's job today is to show a list. It will grow, but nothing currently
needs client-side state, optimistic updates or offline behaviour.

## Decision Drivers

- **Accessibility is a requirement, not a phase.** The cheapest way to be
  accessible is to use the platform: semantic HTML has keyboard support, focus
  management and screen reader semantics already.
- **Low cost.** Static HTML from a function is the cheapest thing to serve and
  cacheable at the edge for free (ADR-0005).
- **The mutation gate applies to the UI too.** Rendering must be assertable
  without a browser, or the 95% threshold becomes unreachable for `web`.

## Considered Options

### Option 1: Server-rendered HTML from a pure function, zero client JS

- **Pros**: `Principle[] -> string` is a pure function, so the entire UI is
  unit tested in microseconds with no DOM, no jsdom and no browser. Works with
  scripting disabled. No bundler, no hydration, no framework to keep current.
- **Cons**: Any future interactivity needs a decision to be revisited. No
  component model, so templates can sprawl if left unchecked.

### Option 2: React (or similar) with SSR and hydration

- **Pros**: Familiar component model, large ecosystem, ready for rich
  interactivity.
- **Cons**: Adds a bundler, a hydration step and a testing library. Ships
  JavaScript to do a job HTML already does. Accessibility regressions become
  easy to introduce via `div`-based components.

### Option 3: Static site generator

- **Pros**: Cheapest possible hosting.
- **Cons**: The analyzer's output is inherently dynamic; pre-rendering
  everything is not viable beyond the current stub.

## Decision

Render HTML **on the server from pure functions**, and ship **no client-side
JavaScript**.

The HTTP surface is a plain `(request: Request) => Promise<Response>` handler,
separate from `Bun.serve`. Binding a port is the shim's job, so the entire web
adapter is tested in process with `new Request(...)`.

The accessibility baseline is enforced by tests, not by intention:
`lang`, `charset`, viewport, a `main` landmark, exactly one `h1`, list
semantics with an accessible name, a visible `:focus-visible` indicator, both
colour schemes and `prefers-reduced-motion` all have assertions.

All interpolated content passes through `escapeHtml` at the boundary.

## Consequences

### Positive

- The UI is tested as fast as the domain, so it sits inside the mutation gate
  rather than being exempted from it.
- Zero JavaScript means no hydration bugs and nothing to ship or cache-bust.
- Regressions in the accessibility baseline fail the build.

### Negative

- Styles live in a `<style>` block inside the template. Fine at this size,
  unpleasant past a few pages.
- There is no component abstraction yet; string templates do not compose well.
- Genuinely interactive features will require revisiting this ADR.

### Risks and mitigations

- *Risk*: String templating leads to an HTML injection bug.
  *Mitigation*: `escapeHtml` is applied at every interpolation of external
  data and is directly tested, including the double-encoding ordering case.
- *Risk*: Assertions on markup become brittle as the page grows.
  *Mitigation*: Assert on semantics (landmarks, roles, accessible names)
  rather than on exact markup wherever possible.
