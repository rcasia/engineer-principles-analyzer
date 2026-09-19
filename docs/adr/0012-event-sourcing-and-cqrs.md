# ADR-0012: Use Event Sourcing and CQRS for application state

**Status**: Accepted
**Date**: 2026-09-19

## Context

Principled needs to evolve rapidly while preserving the ability to reconstruct historical state and reproduce bugs.

The system will accumulate state such as analysis lifecycles, findings, rule versions, evaluation snapshots, suppressions and later project/CI workflows.

Persisting only mutable current-state records would make it harder to:

- understand how a state was reached;
- reproduce historical bugs;
- reconstruct state after changing a read model;
- introduce new read models without rewriting the write model;
- audit state transitions;
- evolve the application without coupling every new view to the write model.

The desired property is:

> State is derived from an immutable history of domain events.

This is a state-management decision. It does not imply distributed messaging.

## Decision Drivers

- Reproducible bug investigation.
- Historical state reconstruction.
- Safe evolution of read models.
- Clear separation between commands and queries.
- Auditable domain transitions.
- Compatibility with the existing hexagonal architecture.
- Avoiding unnecessary infrastructure complexity.

## Considered Options

### Option 1: Mutable CRUD state

Store the latest state in mutable database records.

- **Pros**: simple mental model, familiar tooling, straightforward queries.
- **Cons**: historical transitions are lost unless separately modelled; bug reproduction is weaker; changing read needs often couples storage to presentation.

### Option 2: CRUD plus audit log

Keep mutable state as the source of truth and add an audit trail.

- **Pros**: easier migration from conventional CRUD.
- **Cons**: the audit log is secondary and can diverge from actual state; rebuilding state remains dependent on mutable records.

### Option 3: Event Sourcing + CQRS

Store immutable domain events as the source of truth and derive read models from them.

- **Pros**: deterministic state reconstruction, historical queries, replay, rebuildable projections, clear write/read separation, strong debugging capabilities.
- **Cons**: more domain modelling, event schema evolution, projection management and data-retention complexity.

## Decision

Use **Event Sourcing + CQRS** as the state-management model.

### Command side

Commands load aggregate history, validate invariants and emit immutable events.

### Event store

The event stream is the canonical source of truth.

### Query side

Read models are projections of events and are disposable/rebuildable.

### Consistency

The system should not introduce distributed eventual consistency solely because CQRS is used. Commands may synchronously append events, and projections may be synchronous or asynchronous depending on the feature.

### Infrastructure

No distributed message broker is required by this decision.

The initial implementation should provide:

- append-only event storage;
- aggregate rehydration;
- event versioning;
- projection/rebuild support;
- query models.

Distributed messaging can be introduced later only for an independently justified requirement.

## Event design

Events are:

- immutable;
- typed;
- versioned;
- ordered within a stream;
- idempotently applicable;
- forward-compatible;
- timestamped server-side;
- associated with correlation and causation identifiers.

A stable event envelope should contain at least:

```json
{
  "eventId": "...",
  "eventType": "...",
  "eventVersion": 1,
  "aggregateId": "...",
  "sequence": 12,
  "occurredAt": "...",
  "correlationId": "...",
  "causationId": "...",
  "payload": {}
}
```

## Sensitive customer data

Raw source code, prompts, credentials and other sensitive customer content must not be placed into immutable domain events by default.

Instead:

- events contain minimal domain facts and stable references/hashes;
- sensitive artifacts are stored separately with explicit encryption and retention controls;
- deletion and retention are governed by ADR #28 and the legal documentation in #29.

This preserves replayability without making the immutable event history a permanent copy of customer source code.

## Consequences

### Positive

- Current state can be reconstructed from history.
- Historical state and state transitions are queryable.
- Read models can evolve independently.
- Bugs can be investigated by replaying the same event sequence.
- Metrics and analytics can be derived as projections rather than becoming a second source of truth.
- New capabilities can consume existing events without changing the write path.

### Negative

- Event schemas must be versioned and evolved carefully.
- Projection rebuilds become operational concerns.
- Data deletion is more complicated when immutable history contains identifying metadata.
- The system requires stronger domain modelling than CRUD.

### Risks and mitigations

- **Risk**: Event streams accidentally become a permanent copy of sensitive code.
  **Mitigation**: store sensitive artifacts separately and keep event payloads minimal.

- **Risk**: Projection behaviour changes after a deployment.
  **Mitigation**: version projectors where required and test full rebuilds.

- **Risk**: Probabilistic AI analysis cannot be reproduced exactly.
  **Mitigation**: persist model/rule/version/configuration references and clearly distinguish reproducible state reconstruction from deterministic model inference.

- **Risk**: CQRS is interpreted as requiring microservices or a message broker.
  **Mitigation**: keep command/query separation inside the application initially and introduce distributed infrastructure only when justified.
