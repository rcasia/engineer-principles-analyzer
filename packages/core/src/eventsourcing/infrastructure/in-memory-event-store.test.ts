import { describe, expect, it } from "bun:test";
import { ConcurrencyError, type NewEvent } from "../application/event-store.port.ts";
import { InMemoryEventStore } from "./in-memory-event-store.ts";

const FIXED = "2026-01-01T00:00:00.000Z";
const fixedClock = () => FIXED;

const newEvent = (
  overrides: Partial<NewEvent<{ readonly n: number }>> = {},
): NewEvent<{ readonly n: number }> => ({
  eventId: "e1",
  eventType: "Added",
  eventVersion: 1,
  correlationId: "corr",
  causationId: "cause",
  payload: { n: 1 },
  ...overrides,
});

describe("InMemoryEventStore", () => {
  it("appends to a new stream and returns a fully-formed envelope", async () => {
    const store = new InMemoryEventStore(fixedClock);

    const [appended] = await store.append("s1", 0, [
      newEvent({ eventId: "e1", payload: { n: 42 } }),
    ]);

    expect(appended).toEqual({
      eventId: "e1",
      eventType: "Added",
      eventVersion: 1,
      aggregateId: "s1",
      sequence: 1,
      occurredAt: FIXED,
      correlationId: "corr",
      causationId: "cause",
      payload: { n: 42 },
    });
  });

  it("numbers events contiguously within a single append", async () => {
    const store = new InMemoryEventStore(fixedClock);

    const appended = await store.append("s1", 0, [
      newEvent({ eventId: "e1" }),
      newEvent({ eventId: "e2" }),
    ]);

    expect(appended.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("continues numbering from the stored version across appends", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);

    const [second] = await store.append("s1", 1, [newEvent({ eventId: "e2" })]);

    expect(second?.sequence).toBe(2);
  });

  it("rejects an append whose expected version is stale", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);

    await expect(
      store.append("s1", 0, [newEvent({ eventId: "e2" })]),
    ).rejects.toThrow(
      new ConcurrencyError(
        'Expected stream "s1" at version 0, but it is at version 1.',
      ),
    );
  });

  it("writes nothing when an append is rejected", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);

    await expect(
      store.append("s1", 0, [newEvent({ eventId: "e2" })]),
    ).rejects.toThrow(ConcurrencyError);

    expect(await store.read("s1")).toHaveLength(1);
  });

  it("versions streams independently of one another", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);

    const [other] = await store.append("s2", 0, [newEvent({ eventId: "e2" })]);

    expect(other?.sequence).toBe(1);
  });

  it("reads one stream in sequence order and excludes others", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);
    await store.append("s2", 0, [newEvent({ eventId: "e2" })]);
    await store.append("s1", 1, [newEvent({ eventId: "e3" })]);

    const stream = await store.read("s1");

    expect(stream.map((event) => event.eventId)).toEqual(["e1", "e3"]);
  });

  it("returns an empty history for an unknown stream", async () => {
    const store = new InMemoryEventStore(fixedClock);

    expect(await store.read("nope")).toEqual([]);
  });

  it("reads every stream in global append order", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);
    await store.append("s2", 0, [newEvent({ eventId: "e2" })]);
    await store.append("s1", 1, [newEvent({ eventId: "e3" })]);

    const all = await store.readAll();

    expect(all.map((event) => event.eventId)).toEqual(["e1", "e2", "e3"]);
  });

  it("returns a fresh snapshot from readAll each call", async () => {
    const store = new InMemoryEventStore(fixedClock);
    await store.append("s1", 0, [newEvent({ eventId: "e1" })]);

    expect(await store.readAll()).not.toBe(await store.readAll());
  });

  it("stamps a parseable ISO timestamp with the default clock", async () => {
    const store = new InMemoryEventStore();

    const [appended] = await store.append("s1", 0, [newEvent()]);

    expect(typeof appended?.occurredAt).toBe("string");
    expect(Number.isNaN(Date.parse(appended?.occurredAt ?? ""))).toBe(false);
  });
});
