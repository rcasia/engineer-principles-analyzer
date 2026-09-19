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
 * Narrows `unknown` wire input to a finite number. A single predicate rather
 * than an inline `typeof` disjunct: `!Number.isFinite` already rejects every
 * non-number, which would leave a separate `typeof` check nothing to catch
 * but the type narrowing the compiler needs.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
