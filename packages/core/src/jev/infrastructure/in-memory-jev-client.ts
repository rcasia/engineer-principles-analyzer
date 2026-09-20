import {
  JevTransportError,
  type ChoiceJudgment,
  type ChoiceQuestion,
  type JevClient,
  type NoulJudgment,
  type NoulQuestion,
} from "../application/jev-client.port.ts";

export interface ScriptedNoulJudgment {
  readonly value: number;
  readonly model: string;
}

export interface ScriptedChoiceJudgment {
  readonly choice: string;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly confidence: number;
  readonly model: string;
}

/**
 * Driven adapter backed by memory: answers from a script instead of the
 * network. The real adapter for tests and offline core validation, not a
 * mock — rule tests exercise the same `JevClient` port production uses.
 *
 * Scripted values are validated at construction: a bad fixture must fail
 * loudly here, not silently steer a validation run.
 */
export class InMemoryJevClient implements JevClient {
  private readonly noulScript: readonly ScriptedNoulJudgment[];
  private readonly choiceScript: readonly ScriptedChoiceJudgment[];
  private noulCursor = 0;
  private choiceCursor = 0;
  readonly calls: { readonly state: unknown; readonly question: NoulQuestion }[] =
    [];
  readonly choiceCalls: {
    readonly state: unknown;
    readonly question: ChoiceQuestion;
  }[] = [];

  constructor(
    noulScript: readonly ScriptedNoulJudgment[] = [
      { value: 0.5, model: "in-memory" },
    ],
    choiceScript: readonly ScriptedChoiceJudgment[] = [
      { choice: "other", probabilities: { other: 1 }, confidence: 1, model: "in-memory" },
    ],
  ) {
    for (const judgment of noulScript) {
      if (
        !Number.isFinite(judgment.value) ||
        judgment.value < 0 ||
        judgment.value > 1
      ) {
        throw new Error(
          `InMemoryJevClient script values must be numbers between 0 and 1, got ${judgment.value}.`,
        );
      }
    }

    for (const judgment of choiceScript) {
      if (
        typeof judgment.choice !== "string" ||
        judgment.choice.trim().length === 0
      ) {
        throw new Error(
          `InMemoryJevClient script choices must be non-empty strings, got ${String(judgment.choice)}.`,
        );
      }

      for (const probability of [
        ...Object.values(judgment.probabilities),
        judgment.confidence,
      ]) {
        if (
          !Number.isFinite(probability) ||
          probability < 0 ||
          probability > 1
        ) {
          throw new Error(
            `InMemoryJevClient script probabilities and confidence must be numbers between 0 and 1, got ${probability}.`,
          );
        }
      }
    }

    this.noulScript = [...noulScript];
    this.choiceScript = [...choiceScript];
  }

  async evaluateNoul(input: {
    readonly state: unknown;
    readonly question: NoulQuestion;
  }): Promise<NoulJudgment> {
    const next = this.noulScript[this.noulCursor];
    if (next === undefined) {
      throw new JevTransportError(
        "InMemoryJevClient has no more scripted judgments.",
      );
    }

    this.noulCursor += 1;
    this.calls.push(input);
    return { ...next };
  }

  async evaluateChoice(input: {
    readonly state: unknown;
    readonly question: ChoiceQuestion;
  }): Promise<ChoiceJudgment> {
    const next = this.choiceScript[this.choiceCursor];
    if (next === undefined) {
      throw new JevTransportError(
        "InMemoryJevClient has no more scripted choice judgments.",
      );
    }

    this.choiceCursor += 1;
    this.choiceCalls.push(input);
    return {
      choice: next.choice,
      probabilities: { ...next.probabilities },
      confidence: next.confidence,
      model: next.model,
    };
  }
}
