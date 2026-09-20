import { describe, expect, test } from "bun:test";
import {
  InMemoryJevClient,
  type ScriptedChoiceJudgment,
} from "../../jev/infrastructure/in-memory-jev-client.ts";
import { JevTransportError } from "../../jev/application/jev-client.port.ts";
import { JevLanguageDetector } from "./language-detector.ts";

function scripted(choice: string): ScriptedChoiceJudgment {
  return {
    choice,
    probabilities: { [choice]: 1 },
    confidence: 1,
    model: "in-memory",
  };
}

function detectorWith(
  ...choices: readonly string[]
): {
  readonly detector: JevLanguageDetector;
  readonly client: InMemoryJevClient;
} {
  const client = new InMemoryJevClient(
    [],
    choices.map((choice) => scripted(choice)),
  );
  return { detector: new JevLanguageDetector(client), client };
}

const CRITERIA = {
  typescript:
    "TypeScript: type annotations, interfaces, type aliases, readonly modifiers, .ts and .tsx files.",
  javascript:
    "JavaScript: console.log, require, module.exports, function declarations without type annotations, .js and .jsx files.",
  python:
    "Python: def, print(), if __name__, elif, significant indentation, .py files.",
  go: "Go: package clause, func declarations, fmt.Print, .go files.",
  rust: "Rust: fn, let mut, println!, .rs files.",
  java: "Java: public class, System.out.println, import java., .java files.",
  other:
    "None of the above: the source is in a language not listed here, or its language cannot be determined.",
};

describe("JevLanguageDetector", () => {
  test.each([
    ["typescript"],
    ["javascript"],
    ["python"],
    ["go"],
    ["rust"],
    ["java"],
  ])("returns %p when Jev selects it", async (language) => {
    const { detector } = detectorWith(language);

    await expect(
      detector.detectLanguage("some source", "main.txt"),
    ).resolves.toBe(language);
  });

  test("returns undefined when Jev selects the no-match option", async () => {
    const { detector } = detectorWith("other");

    await expect(detector.detectLanguage("hello world")).resolves.toBe(
      undefined,
    );
  });

  test.each([[""], ["   "]])(
    "returns undefined for %p without asking Jev",
    async (sourceCode) => {
      const { detector, client } = detectorWith("go");

      await expect(detector.detectLanguage(sourceCode)).resolves.toBe(
        undefined,
      );
      expect(client.choiceCalls).toEqual([]);
    },
  );

  test("sends the source and filename as the judgment state", async () => {
    const { detector, client } = detectorWith("python");

    await detector.detectLanguage("def greet(name):", "main.py");

    expect(client.choiceCalls[0]?.state).toEqual({
      sourceCode: "def greet(name):",
      filename: "main.py",
    });
  });

  test("sends an empty filename when no hint is given", async () => {
    const { detector, client } = detectorWith("go");

    await detector.detectLanguage("package main");

    expect(client.choiceCalls[0]?.state).toEqual({
      sourceCode: "package main",
      filename: "",
    });
  });

  test("asks exactly one language question with the full option set", async () => {
    const { detector, client } = detectorWith("rust");

    await detector.detectLanguage("fn main() {", "lib.rs");

    expect(client.choiceCalls).toHaveLength(1);
    expect(client.choiceCalls[0]?.question).toEqual({
      instructions:
        "What programming language is this source code written in? Judge from the code itself, using the filename extension only as a hint when it names a known language.",
      criteria: CRITERIA,
    });
  });

  test("propagates a Jev transport failure instead of guessing", async () => {
    const { detector } = detectorWith();

    const error = await detector
      .detectLanguage("package main")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JevTransportError);
    expect((error as Error).message).toBe(
      "InMemoryJevClient has no more scripted choice judgments.",
    );
  });
});
