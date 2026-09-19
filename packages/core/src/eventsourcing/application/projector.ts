import type { EventEnvelope } from "../domain/event.ts";
import type { Projection } from "./projection.port.ts";

/**
 * Drives a {@link Projection} to keep a read model current.
 *
 * The runner is idempotent: an event whose `eventId` has already been applied
 * is ignored, so duplicate delivery cannot corrupt the read model (ADR-0012
 * acceptance criteria). `rebuild` throws the read model away and replays a
 * fresh history from scratch, which is how a projection is changed safely.
 */
export class Projector<TReadModel> {
  private readModel: TReadModel;
  private readonly applied = new Set<string>();

  constructor(private readonly projection: Projection<TReadModel>) {
    this.readModel = projection.initial;
  }

  /** Apply one event, skipping it if it has already been seen. */
  apply(event: EventEnvelope): TReadModel {
    if (!this.applied.has(event.eventId)) {
      this.applied.add(event.eventId);
      this.readModel = this.projection.apply(this.readModel, event);
    }

    return this.readModel;
  }

  /** Discard the read model and rebuild it from the given history. */
  rebuild(history: readonly EventEnvelope[]): TReadModel {
    this.readModel = this.projection.initial;
    this.applied.clear();

    for (const event of history) {
      this.apply(event);
    }

    return this.readModel;
  }

  /** The current read model. */
  get state(): TReadModel {
    return this.readModel;
  }
}
