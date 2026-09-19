export type { Principle } from "./principles/domain/principle.ts";
export {
  InvalidScoreError,
  MAXIMUM_SCORE,
  MINIMUM_SCORE,
  Score,
} from "./principles/domain/score.ts";
export type { PrincipleCatalog } from "./principles/application/principle-catalog.port.ts";
export { ListPrinciples } from "./principles/application/list-principles.use-case.ts";
export { InMemoryPrincipleCatalog } from "./principles/infrastructure/in-memory-principle-catalog.ts";

// Event sourcing + CQRS foundation (ADR-0012).
export type { EventEnvelope } from "./eventsourcing/domain/event.ts";
export type { Decider } from "./eventsourcing/domain/decider.ts";
export {
  rehydrate,
  rehydrateAt,
} from "./eventsourcing/domain/rehydrate.ts";
export {
  ConcurrencyError,
  type EventStore,
  type NewEvent,
} from "./eventsourcing/application/event-store.port.ts";
export type { Projection } from "./eventsourcing/application/projection.port.ts";
export { Projector } from "./eventsourcing/application/projector.ts";
export {
  type Clock,
  InMemoryEventStore,
} from "./eventsourcing/infrastructure/in-memory-event-store.ts";
