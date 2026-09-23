import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidSubjectError extends Error {
  override readonly name = "InvalidSubjectError";
}

/**
 * Sentinel language for submissions whose language could not be identified
 * (ADR-0040). It is a valid, non-empty `Subject.language`: analysis proceeds
 * instead of blocking — heuristic rules report `not_applicable` for it and
 * Jev-backed rules judge the source generically, since the underlying
 * concepts hold across languages.
 */
export const UNKNOWN_LANGUAGE = "unknown";

export interface SubjectProps {
  /** The code being analyzed. Never persisted by the engine itself (#9, #28). */
  readonly sourceCode: string;
  /**
   * The language to analyze `sourceCode` as, e.g. `"typescript"`.
   * `"unknown"` (see {@link UNKNOWN_LANGUAGE}) means detection drew a blank
   * and the run proceeds generically instead of blocking (ADR-0040).
   */
  readonly language: string;
}

/**
 * What a rule is evaluated against: one subject's source and the language
 * it should be read as.
 *
 * Deliberately narrower than a whole project — project-level analysis is
 * #22. Keeping `sourceCode` and `language` as the only fields means a rule
 * cannot depend on anything the engine has not been asked to provide, which
 * is what lets "one rule, one subject" stay the unit both the CLI and the
 * web UI drive (#9's acceptance criteria).
 *
 * Immutable value object: the only way to obtain one is {@link Subject.of},
 * which returns a {@link Result} rather than throwing — empty source or an
 * unnamed language are expected outcomes of validating a CLI flag or a web
 * form, not exceptional conditions.
 */
export class Subject {
  private constructor(
    readonly sourceCode: string,
    readonly language: string,
  ) {}

  static of(props: SubjectProps): Result<Subject, InvalidSubjectError> {
    if (props.sourceCode.trim().length === 0) {
      return err(new InvalidSubjectError("sourceCode must not be empty."));
    }

    if (props.language.trim().length === 0) {
      return err(new InvalidSubjectError("language must not be empty."));
    }

    return ok(new Subject(props.sourceCode, props.language));
  }
}
