import type { EventEnvelope } from "../domain/event.ts";
import {
  ConcurrencyError,
  type EventStore,
  type NewEvent,
} from "../application/event-store.port.ts";

/** Supplies the server-side timestamp stamped onto each event. */
export type Clock = () => string;

const systemClock: Clock = () => new Date().toISOString();

/**
 * A real {@link EventStore} that keeps events in memory.
 *
 * It is a genuine adapter, not a mock: tests exercise the same port the
 * production store will implement (AGENTS.md, "Writing tests"). The clock is
 * injected so timestamps are deterministic under test — the only I/O the
 * store performs.
 */
export class InMemoryEventStore implements EventStore {
  private readonly log: EventEnvelope[] = [];

  constructor(private readonly now: Clock = systemClock) {}

  async append<TPayload>(
    streamId: string,
    expectedVersion: number,
    events: readonly NewEvent<TPayload>[],
  ): Promise<readonly EventEnvelope<TPayload>[]> {
    const currentVersion = this.versionOf(streamId);

    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(
        `Expected stream "${streamId}" at version ${expectedVersion}, ` +
          `but it is at version ${currentVersion}.`,
      );
    }

    const appended = events.map(
      (event, index): EventEnvelope<TPayload> => ({
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        aggregateId: streamId,
        sequence: expectedVersion + index + 1,
        occurredAt: this.now(),
        correlationId: event.correlationId,
        causationId: event.causationId,
        payload: event.payload,
      }),
    );

    this.log.push(...appended);

    return appended;
  }

  async read(streamId: string): Promise<readonly EventEnvelope[]> {
    return this.log.filter((event) => event.aggregateId === streamId);
  }

  async readAll(): Promise<readonly EventEnvelope[]> {
    return [...this.log];
  }

  private versionOf(streamId: string): number {
    return this.log.filter((event) => event.aggregateId === streamId).length;
  }
}
