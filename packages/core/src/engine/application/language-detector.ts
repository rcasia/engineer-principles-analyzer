import type {
  ChoiceQuestion,
  JevClient,
} from "../../jev/application/jev-client.port.ts";

/**
 * What the web adapter needs to turn a submission into a `Subject`: the
 * language of one source text, or `undefined` when it cannot be told.
 */
export interface LanguageDetector {
  detectLanguage(
    sourceCode: string,
    filenameHint?: string,
  ): Promise<string | undefined>;
}

const INSTRUCTIONS =
  "What programming language is this source code written in? Judge from the code itself, using the filename extension only as a hint when it names a known language.";

/**
 * The closed option set behind the language question. Six supported languages plus
 * an explicit no-match outcome: the model can always say none of the others
 * fit instead of forcing a guess, and the detector maps that outcome to
 * `undefined` so the caller falls back to `"unknown"` (ADR-0040) instead of
 * blocking.
 */
const CRITERIA: Readonly<Record<string, string>> = {
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

const UNKNOWN_OPTION = "other";

/**
 * Asks Jev's Choice primitive which language a submission is written in
 * (ADR-0028, ADR-0040), replacing the dependency-free textual heuristics outright:
 * filename and source travel together as the judgment state and code only
 * maps the answer.
 *
 * An application service, not domain: detection performs I/O through the
 * injected `JevClient`, so it lives beside the `AnalyzeSubject` use case
 * rather than in `engine/domain/`. A blank source resolves to `undefined`
 * without a request — there is nothing to judge — and an `other` verdict
 * does the same, so callers run as `"unknown"` instead of blocking. Jev
 * failures propagate untouched: the caller decides the fallback (the
 * web adapter runs them as `"unknown"`).
 */
export class JevLanguageDetector implements LanguageDetector {
  private readonly client: JevClient;

  constructor(client: JevClient) {
    this.client = client;
  }

  async detectLanguage(
    sourceCode: string,
    filenameHint?: string,
  ): Promise<string | undefined> {
    if (sourceCode.trim().length === 0) {
      return undefined;
    }

    const question: ChoiceQuestion = {
      instructions: INSTRUCTIONS,
      criteria: { ...CRITERIA },
    };
    const judgment = await this.client.evaluateChoice({
      state: { sourceCode, filename: filenameHint ?? "" },
      question,
    });

    if (judgment.choice === UNKNOWN_OPTION) {
      return undefined;
    }

    return judgment.choice;
  }
}
