# ADR-0002: Organise code as vertical slices over a hexagon

**Status**: Accepted
**Date**: 2026-09-19

## Context

`core` will be consumed by a CLI and a web UI, and will eventually read from
git repositories, APIs and local files. The analysis rules are the valuable
part; the places data comes from are not.

At the time of writing the domain is deliberately a **stub**: we have decided
*how* the code is shaped, not *what* the principles are.

## Decision Drivers

- **The domain must not depend on I/O.** Rules have to be testable without a
  network, a filesystem or a clock, because mutation testing (ADR-0003) runs
  the suite hundreds of times.
- **Features are added whole.** A new capability should touch one directory,
  not four layer-shaped ones.
- **Two very different adapters** (CLI, web) must reuse the same behaviour.

## Considered Options

### Option 1: Vertical slices, each internally ports-and-adapters

Directory per capability, and inside it `domain/`, `application/`,
`infrastructure/`.

- **Pros**: A feature is one folder, so it can be added, understood or deleted
  as a unit. Dependencies still point inward, so the domain stays pure.
- **Cons**: The layer folders repeat inside every slice.

### Option 2: Layer-first (`src/domain`, `src/application`, `src/infrastructure`)

- **Pros**: Conventional and immediately familiar.
- **Cons**: Every feature is smeared across three top-level folders; unrelated
  features end up adjacent, and deleting one is archaeology.

### Option 3: No layering, plain modules

- **Pros**: Least ceremony, fastest to start.
- **Cons**: I/O leaks into rules almost immediately, which makes the mutation
  testing gate impossible to hold.

## Decision

Use **vertical slices, each internally structured as ports and adapters**.

```
packages/core/src/
  principles/                                  <- slice
    domain/          score.ts, principle.ts    <- pure, no imports outward
    application/     *.port.ts, *.use-case.ts  <- ports and orchestration
    infrastructure/  *.ts                      <- adapters implementing ports
  index.ts                                     <- the package's public surface
```

Rules:

- `domain/` imports nothing from `application/` or `infrastructure/`.
- `application/` defines ports as interfaces; it never imports an adapter.
- `infrastructure/` implements ports; nothing imports it except composition.
- Only `index.ts` is public. Adapters compose the hexagon from there.

Value objects enforce their own invariants — `Score.of` is the only way to get
a `Score`, so an out-of-range score cannot exist. This is the SOLID part that
matters most here: callers depend on the abstraction, not on validation
scattered at call sites.

## Consequences

### Positive

- Every unit in `core` is testable with no test doubles for I/O, because there
  is no I/O in the domain.
- `InMemoryPrincipleCatalog` is a real adapter, not a mock, so tests exercise
  the same port the production adapters will implement.
- A second slice can be added without touching the first.

### Negative

- More files than the behaviour currently justifies. For a stub domain this
  looks like over-engineering, and it is a real cost today.
- Contributors must learn the dependency rule; nothing currently enforces it
  mechanically.

### Risks and mitigations

- *Risk*: The dependency rule erodes, and `domain/` starts importing adapters.
  *Mitigation*: Accepted for now, as the surface is tiny. If `core` grows past
  a handful of slices, add an import-boundary lint rule as a CI gate. Tracked
  as a follow-up rather than built speculatively.
