import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidJevResponseError extends Error {
  override readonly name = "InvalidJevResponseError";
}

export interface ParsedNoulAnswer {
  /** Calibrated probability that the answer is yes, in `[0, 1]`. */
  readonly value: number;
  /** Model that answered, e.g. `"jev-1.13.0"`. Recorded, never trusted. */
  readonly model: string;
}

export interface ParsedChoiceAnswer {
  /** The option the model selected: the highest-probability entry. */
  readonly choice: string;
  /** Probability per option; the entries sum to 1. */
  readonly probabilities: Readonly<Record<string, number>>;
  /** How concentrated `probabilities` is, in `[0, 1]`. */
  readonly confidence: number;
  /** Model that answered, e.g. `"jev-1.13.0"`. Recorded, never trusted. */
  readonly model: string;
}

/**
 * Validates an untrusted SystemOne response body into the Noul answer for
 * one question. Strict on purpose: the wire is a trust boundary, and a
 * shape change on TypeSafe's side must surface as a loud
 * `InvalidJevResponseError` (which the engine isolates into
 * `unable_to_analyze`) rather than a silently misread verdict.
 */
export function parseNoulAnswerBody(
  body: unknown,
  questionId: string,
): Result<ParsedNoulAnswer, InvalidJevResponseError> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return err(
      new InvalidJevResponseError("Jev response body must be an object."),
    );
  }

  const model: unknown = (body as { readonly model?: unknown }).model;
  if (typeof model !== "string" || model.trim().length === 0) {
    return err(
      new InvalidJevResponseError(
        "Jev response model must be a non-empty string.",
      ),
    );
  }

  const answers: unknown = (body as { readonly answers?: unknown }).answers;
  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return err(
      new InvalidJevResponseError("Jev response answers must be an object."),
    );
  }

  const answer: unknown = (answers as Record<string, unknown>)[questionId];
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return err(
      new InvalidJevResponseError(
        `Jev response has no answer for question "${questionId}".`,
      ),
    );
  }

  if ((answer as { readonly type?: unknown }).type !== "noul") {
    return err(
      new InvalidJevResponseError(
        `Jev answer for question "${questionId}" must be a noul answer.`,
      ),
    );
  }

  const value: unknown = (answer as { readonly noul?: unknown }).noul;
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    return err(
      new InvalidJevResponseError(
        `Jev answer noul for question "${questionId}" must be a number between 0 and 1.`,
      ),
    );
  }

  return ok({ value, model });
}

/**
 * Validates an untrusted SystemOne response body into the Choice answer for
 * one question. Same trust boundary as the Noul parser: strict, so a shape
 * change surfaces as a loud `InvalidJevResponseError` rather than a
 * silently misread selection. `expectedOptions` is the exact option set the
 * request carried — the answer must pick one of them and score every one.
 */
export function parseChoiceAnswerBody(
  body: unknown,
  questionId: string,
  expectedOptions: readonly string[],
): Result<ParsedChoiceAnswer, InvalidJevResponseError> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return err(
      new InvalidJevResponseError("Jev response body must be an object."),
    );
  }

  const model: unknown = (body as { readonly model?: unknown }).model;
  if (typeof model !== "string" || model.trim().length === 0) {
    return err(
      new InvalidJevResponseError(
        "Jev response model must be a non-empty string.",
      ),
    );
  }

  const answers: unknown = (body as { readonly answers?: unknown }).answers;
  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return err(
      new InvalidJevResponseError("Jev response answers must be an object."),
    );
  }

  const answer: unknown = (answers as Record<string, unknown>)[questionId];
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return err(
      new InvalidJevResponseError(
        `Jev response has no answer for question "${questionId}".`,
      ),
    );
  }

  if ((answer as { readonly type?: unknown }).type !== "choice") {
    return err(
      new InvalidJevResponseError(
        `Jev answer for question "${questionId}" must be a choice answer.`,
      ),
    );
  }

  // `includes` already rejects every non-string at runtime, so no `typeof`
  // disjunct is needed; the cast only tells the compiler what `includes`
  // already guarantees.
  const choice = (answer as { readonly choice?: unknown }).choice as string;
  if (!expectedOptions.includes(choice)) {
    return err(
      new InvalidJevResponseError(
        `Jev answer choice for question "${questionId}" must be one of: ${expectedOptions.join(", ")}.`,
      ),
    );
  }

  const probabilities: unknown = (
    answer as { readonly probabilities?: unknown }
  ).probabilities;
  if (
    typeof probabilities !== "object" ||
    probabilities === null ||
    Array.isArray(probabilities)
  ) {
    return err(
      new InvalidJevResponseError(
        `Jev answer probabilities for question "${questionId}" must be an object.`,
      ),
    );
  }

  for (const option of expectedOptions) {
    const probability: unknown = (probabilities as Record<string, unknown>)[
      option
    ];
    if (
      !isFiniteNumber(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      return err(
        new InvalidJevResponseError(
          `Jev answer probabilities for question "${questionId}" must map every option to a number between 0 and 1.`,
        ),
      );
    }
  }

  const confidence: unknown = (answer as { readonly confidence?: unknown })
    .confidence;
  if (!isFiniteNumber(confidence) || confidence < 0 || confidence > 1) {
    return err(
      new InvalidJevResponseError(
        `Jev answer confidence for question "${questionId}" must be a number between 0 and 1.`,
      ),
    );
  }

  return ok({
    choice,
    probabilities: { ...(probabilities as Record<string, number>) },
    confidence,
    model,
  });
}

/**
 * Narrows `unknown` wire input to a finite number. `Number.isFinite` already
 * rejects every non-number (unlike the coercing global `isFinite`), so no
 * separate `typeof` check is needed — the predicate signature alone gives
 * the compiler the narrowing the callers rely on.
 */
function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}
