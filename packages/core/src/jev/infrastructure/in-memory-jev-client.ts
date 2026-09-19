import {
  JevTransportError,
  type JevClient,
  type NoulJudgment,
  type NoulQuestion,
} from "../application/jev-client.port.ts";

export interface ScriptedNoulJudgment {
  readonly value: number;
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
  private readonly script: readonly ScriptedNoulJudgment[];
  private cursor = 0;
  readonly calls: { readonly state: unknown; readonly question: NoulQuestion }[] =
    [];

  constructor(
    script: readonly ScriptedNoulJudgment[] = [
      { value: 0.5, model: "in-memory" },
    ],
  ) {
    for (const judgment of script) {
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

    this.script = [...script];
  }

  async evaluateNoul(input: {
    readonly state: unknown;
    readonly question: NoulQuestion;
  }): Promise<NoulJudgment> {
    const next = this.script[this.cursor];
    if (next === undefined) {
      throw new JevTransportError(
        "InMemoryJevClient has no more scripted judgments.",
      );
    }

    this.cursor += 1;
    this.calls.push(input);
    return { ...next };
  }
}
