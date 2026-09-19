/**
 * An immutable domain event as it lives in a stream.
 *
 * This is the stable envelope from ADR-0012: a small set of facts about a
 * state transition plus the identifiers needed to order, correlate and
 * reproduce it. The event store owns `aggregateId`, `sequence` and
 * `occurredAt`; everything else is supplied by the writer.
 *
 * Payloads carry minimal domain facts and stable references/hashes only —
 * never raw source code, prompts or credentials (ADR-0012, "Sensitive
 * customer data").
 */
export interface EventEnvelope<TPayload = unknown> {
  /** Globally unique identity of this event; the unit of idempotency. */
  readonly eventId: string;
  /** Discriminates the payload shape, e.g. "AnalysisCompleted". */
  readonly eventType: string;
  /** Schema version of `payload`, so `eventType` can evolve over time. */
  readonly eventVersion: number;
  /** The stream this event belongs to. */
  readonly aggregateId: string;
  /** Position within the stream, starting at 1 and contiguous. */
  readonly sequence: number;
  /** Server-side timestamp, ISO-8601, assigned on append. */
  readonly occurredAt: string;
  /** Ties together every event caused by the same originating request. */
  readonly correlationId: string;
  /** The event or command that directly caused this one. */
  readonly causationId: string;
  /** The domain facts of the transition. */
  readonly payload: TPayload;
}
