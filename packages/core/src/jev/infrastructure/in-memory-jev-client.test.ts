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

const CHOICE_INPUT = {
  state: { sourceCode: "package main", filename: "" },
  question: {
    instructions: "What programming language is this?",
    criteria: { go: "Go source.", other: null },
  },
};

function choiceJudgment(overrides = {}) {
  return {
    choice: "go",
    probabilities: { go: 0.9, other: 0.1 },
    confidence: 0.85,
    model: "in-memory",
    ...overrides,
  };
}

describe("InMemoryJevClient.evaluateChoice", () => {
  test("answers other from the in-memory model by default", async () => {
    const client = new InMemoryJevClient();

    expect(await client.evaluateChoice(CHOICE_INPUT)).toEqual({
      choice: "other",
      probabilities: { other: 1 },
      confidence: 1,
      model: "in-memory",
    });
  });

  test("replays scripted judgments in order", async () => {
    const client = new InMemoryJevClient([], [
      choiceJudgment({ choice: "go", model: "first" }),
      choiceJudgment({ choice: "other", model: "second" }),
    ]);

    expect(await client.evaluateChoice(CHOICE_INPUT)).toEqual(
      choiceJudgment({ choice: "go", model: "first" }),
    );
    expect(await client.evaluateChoice(CHOICE_INPUT)).toEqual(
      choiceJudgment({ choice: "other", model: "second" }),
    );
  });

  test("tracks noul and choice cursors independently", async () => {
    const client = new InMemoryJevClient(
      [{ value: 0.9, model: "noul-first" }],
      [choiceJudgment({ model: "choice-first" })],
    );

    expect(await client.evaluateChoice(CHOICE_INPUT)).toEqual(
      choiceJudgment({ model: "choice-first" }),
    );
    expect(await client.evaluateNoul(INPUT)).toEqual({
      value: 0.9,
      model: "noul-first",
    });
  });

  test("fails loudly once the choice script is exhausted", async () => {
    const client = new InMemoryJevClient([], [choiceJudgment()]);
    await client.evaluateChoice(CHOICE_INPUT);

    const error = await client
      .evaluateChoice(CHOICE_INPUT)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JevTransportError);
    expect((error as Error).message).toBe(
      "InMemoryJevClient has no more scripted choice judgments.",
    );
  });

  test("records every choice call input for assertions", async () => {
    const client = new InMemoryJevClient();
    await client.evaluateChoice(CHOICE_INPUT);

    expect(client.choiceCalls).toEqual([CHOICE_INPUT]);
    expect(client.calls).toEqual([]);
  });

  test("rejects a blank scripted choice at construction", () => {
    expect(
      () => new InMemoryJevClient([], [choiceJudgment({ choice: "  " })]),
    ).toThrow(
      "InMemoryJevClient script choices must be non-empty strings, got   .",
    );
  });

  test("rejects a non-string scripted choice at construction", () => {
    expect(
      () =>
        new InMemoryJevClient([], [choiceJudgment({ choice: 7 as unknown as string })]),
    ).toThrow(
      "InMemoryJevClient script choices must be non-empty strings, got 7.",
    );
  });

  test("rejects a scripted probability above 1 at construction", () => {
    expect(
      () =>
        new InMemoryJevClient(
          [],
          [choiceJudgment({ probabilities: { go: 2, other: 0 } })],
        ),
    ).toThrow(
      "InMemoryJevClient script probabilities and confidence must be numbers between 0 and 1, got 2.",
    );
  });

  test("rejects a scripted probability below 0 at construction", () => {
    expect(
      () =>
        new InMemoryJevClient(
          [],
          [choiceJudgment({ probabilities: { go: 0.5, other: -0.5 } })],
        ),
    ).toThrow(
      "InMemoryJevClient script probabilities and confidence must be numbers between 0 and 1, got -0.5.",
    );
  });

  test("accepts the boundary values 0 and 1 in a choice script", async () => {
    const client = new InMemoryJevClient([], [
      choiceJudgment({
        probabilities: { go: 1, other: 0 },
        confidence: 0,
        model: "edge",
      }),
    ]);

    expect(await client.evaluateChoice(CHOICE_INPUT)).toEqual(
      choiceJudgment({
        probabilities: { go: 1, other: 0 },
        confidence: 0,
        model: "edge",
      }),
    );
  });

  test("rejects a scripted NaN confidence at construction", () => {
    expect(
      () =>
        new InMemoryJevClient(
          [],
          [choiceJudgment({ confidence: Number.NaN })],
        ),
    ).toThrow(
      "InMemoryJevClient script probabilities and confidence must be numbers between 0 and 1, got NaN.",
    );
  });
});
