import { describe, expect, it } from "bun:test";
import type { EventEnvelope } from "../domain/event.ts";
import type { Projection } from "./projection.port.ts";
import { Projector } from "./projector.ts";

const event = (eventId: string, amount: number): EventEnvelope<number> => ({
  eventId,
  eventType: "Added",
  eventVersion: 1,
  aggregateId: "a",
  sequence: 1,
  occurredAt: "2026-01-01T00:00:00.000Z",
  correlationId: "corr",
  causationId: "cause",
  payload: amount,
});

const sum: Projection<number> = {
  initial: 0,
  apply: (total, applied) => total + (applied.payload as number),
};

describe("Projector", () => {
  it("starts at the projection's initial read model", () => {
    expect(new Projector(sum).state).toBe(0);
  });

  it("applies an event and returns the updated read model", () => {
    const projector = new Projector(sum);

    expect(projector.apply(event("e1", 3))).toBe(3);
    expect(projector.state).toBe(3);
  });

  it("accumulates distinct events", () => {
    const projector = new Projector(sum);
    projector.apply(event("e1", 3));
    projector.apply(event("e2", 4));

    expect(projector.state).toBe(7);
  });

  it("ignores an event whose id has already been applied", () => {
    const projector = new Projector(sum);
    projector.apply(event("e1", 3));

    expect(projector.apply(event("e1", 3))).toBe(3);
    expect(projector.state).toBe(3);
  });

  it("rebuilds a read model from scratch, discarding prior state", () => {
    const projector = new Projector(sum);
    projector.apply(event("stale", 99));

    expect(projector.rebuild([event("e1", 1), event("e2", 2)])).toBe(3);
    expect(projector.state).toBe(3);
  });

  it("clears seen ids on rebuild so previously-applied events count again", () => {
    const projector = new Projector(sum);
    projector.apply(event("e1", 5));

    expect(projector.rebuild([event("e1", 1)])).toBe(1);
  });

  it("dedupes duplicate events within a rebuilt history", () => {
    expect(new Projector(sum).rebuild([event("e1", 1), event("e1", 1)])).toBe(1);
  });

  it("rebuilds to the initial read model for an empty history", () => {
    const projector = new Projector(sum);
    projector.apply(event("e1", 5));

    expect(projector.rebuild([])).toBe(0);
  });
});
