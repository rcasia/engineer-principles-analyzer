import { describe, expect, test } from "bun:test";
import { JevTransportError } from "../application/jev-client.port.ts";
import { InMemoryJevClient } from "./in-memory-jev-client.ts";

const INPUT = {
  state: { sourceCode: "class Foo {}", language: "typescript" },
  question: { instructions: "Does this violate SRP?" },
};

describe("InMemoryJevClient", () => {
  test("answers 0.5 from the in-memory model by default", async () => {
    const client = new InMemoryJevClient();

    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 0.5,
      model: "in-memory",
    });
  });

  test("replays scripted judgments in order", async () => {
    const client = new InMemoryJevClient([
      { value: 0.9, model: "first" },
      { value: 0.1, model: "second" },
    ]);

    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 0.9,
      model: "first",
    });
    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 0.1,
      model: "second",
    });
  });

  test("fails loudly once the script is exhausted", async () => {
    const client = new InMemoryJevClient([{ value: 0.9, model: "first" }]);
    await client.evaluateNoul(INPUT);

    const error = await client
      .evaluateNoul(INPUT)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JevTransportError);
    expect((error as Error).message).toBe(
      "InMemoryJevClient has no more scripted judgments.",
    );
  });

  test("records every call input for assertions", async () => {
    const client = new InMemoryJevClient();
    await client.evaluateNoul(INPUT);

    expect(client.calls).toEqual([INPUT]);
  });

  test("accepts the boundary values 0 and 1", async () => {
    const client = new InMemoryJevClient([
      { value: 0, model: "low" },
      { value: 1, model: "high" },
    ]);

    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 0,
      model: "low",
    });
    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 1,
      model: "high",
    });
  });

  test("rejects a scripted value above 1 at construction", () => {
    expect(
      () => new InMemoryJevClient([{ value: 2, model: "bad" }]),
    ).toThrow(
      "InMemoryJevClient script values must be numbers between 0 and 1, got 2.",
    );
  });

  test("rejects a scripted NaN at construction", () => {
    expect(
      () => new InMemoryJevClient([{ value: Number.NaN, model: "bad" }]),
    ).toThrow(
      "InMemoryJevClient script values must be numbers between 0 and 1, got NaN.",
    );
  });

  test("rejects a scripted value below 0 at construction", () => {
    expect(
      () => new InMemoryJevClient([{ value: -0.5, model: "bad" }]),
    ).toThrow(
      "InMemoryJevClient script values must be numbers between 0 and 1, got -0.5.",
    );
  });
});
