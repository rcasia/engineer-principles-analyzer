import type { EventEnvelope } from "../domain/event.ts";

/**
 * The read side of CQRS: how a read model is derived from events.
 *
 * A projection is pure — `initial` is the empty read model and `apply` folds
 * one event into it. Because it holds no state of its own, a read model is
 * disposable and can be rebuilt from the event history at any time
 * (ADR-0012, "Query side"). Ordering of `apply` calls is the runner's job;
 * see {@link Projector}.
 */
export interface Projection<TReadModel> {
  /** The read model before any event has been applied. */
  readonly initial: TReadModel;
  /** Fold a single event into the read model. Must be deterministic. */
  apply(readModel: TReadModel, event: EventEnvelope): TReadModel;
}
