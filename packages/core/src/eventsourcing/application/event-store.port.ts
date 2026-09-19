import type { EventEnvelope } from "../domain/event.ts";

/**
 * An event the writer wants to append. The store owns the placement facts
 * (`aggregateId`, `sequence`, `occurredAt`); the writer owns everything that
 * describes *what* happened.
 */
export interface NewEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly correlationId: string;
  readonly causationId: string;
  readonly payload: TPayload;
}

/**
 * Raised when a stream is not at the version the writer expected, i.e. another
 * writer appended concurrently. This is the optimistic-concurrency guard that
 * keeps a stream's ordering and invariants intact (ADR-0012).
 */
export class ConcurrencyError extends Error {
  override readonly name = "ConcurrencyError";
}

/**
 * Driven port: append-only event storage and stream reads.
 *
 * The command side appends events after checking invariants; the query side
 * reads them to build projections. This is the smallest surface ADR-0012 asks
 * the initial implementation to provide, with no distributed messaging.
 */
export interface EventStore {
  /**
   * Append events to the end of a stream. `expectedVersion` must equal the
   * number of events already in the stream (0 for a new stream); otherwise a
   * {@link ConcurrencyError} is thrown and nothing is written. Returns the
   * appended events with their assigned sequence and timestamp.
   */
  append<TPayload>(
    streamId: string,
    expectedVersion: number,
    events: readonly NewEvent<TPayload>[],
  ): Promise<readonly EventEnvelope<TPayload>[]>;

  /** Every event in one stream, in sequence order. */
  read(streamId: string): Promise<readonly EventEnvelope[]>;

  /** Every event across all streams, in global append order. */
  readAll(): Promise<readonly EventEnvelope[]>;
}
