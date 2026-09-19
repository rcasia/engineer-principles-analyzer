import { describe, expect, it } from "bun:test";
import type { EventEnvelope } from "./event.ts";
import { rehydrate, rehydrateAt } from "./rehydrate.ts";

const add = (state: number, event: { readonly amount: number }): number =>
  state + event.amount;

const envelope = (sequence: number, amount: number): EventEnvelope<number> => ({
  eventId: `e${sequence}`,
  eventType: "Added",
  eventVersion: 1,
  aggregateId: "a",
  sequence,
  occurredAt: "2026-01-01T00:00:00.000Z",
  correlationId: "corr",
  causationId: "cause",
  payload: amount,
});

const addPayload = (state: number, event: EventEnvelope<number>): number =>
  state + event.payload;

describe("rehydrate", () => {
  it("returns the initial state unchanged for an empty history", () => {
    expect(rehydrate(7, [], add)).toBe(7);
  });

  it("folds every event into the initial state", () => {
    expect(rehydrate(1, [{ amount: 2 }, { amount: 4 }], add)).toBe(7);
  });

  it("applies events left to right, in order", () => {
    const append = (state: string, event: string): string => state + event;

    expect(rehydrate("", ["a", "b", "c"], append)).toBe("abc");
  });
});

describe("rehydrateAt", () => {
  const history = [envelope(1, 1), envelope(2, 2), envelope(3, 4)];

  it("includes only the event exactly at the boundary", () => {
    expect(rehydrateAt(0, history, addPayload, 1)).toBe(1);
  });

  it("includes events up to and including the boundary", () => {
    expect(rehydrateAt(0, history, addPayload, 2)).toBe(3);
  });

  it("excludes events after the boundary", () => {
    expect(rehydrateAt(0, history, addPayload, 3)).toBe(7);
  });

  it("returns the initial state when the boundary precedes the first event", () => {
    expect(rehydrateAt(5, history, addPayload, 0)).toBe(5);
  });
});
