import { err, ok, type Result } from "../../shared/result.ts";

export const MINIMUM_CONFIDENCE = 0;
export const MAXIMUM_CONFIDENCE = 1;

export class InvalidConfidenceError extends Error {
  override readonly name = "InvalidConfidenceError";
}

/**
 * How sure the analyzer is that a status is correct, as a probability.
 *
 * Immutable value object: the only way to obtain one is {@link Confidence.of},
 * so a result can never carry a confidence outside `[0, 1]`. An
 * out-of-range value is an expected outcome of validating untrusted
 * input, so `of` returns a {@link Result} rather than throwing.
 */
export class Confidence {
  private constructor(readonly value: number) {}

  static of(value: number): Result<Confidence, InvalidConfidenceError> {
    if (!Number.isFinite(value)) {
      return err(
        new InvalidConfidenceError("Confidence must be a finite number."),
      );
    }

    if (value < MINIMUM_CONFIDENCE || value > MAXIMUM_CONFIDENCE) {
      return err(
        new InvalidConfidenceError(
          `Confidence must be between ${MINIMUM_CONFIDENCE} and ${MAXIMUM_CONFIDENCE}.`,
        ),
      );
    }

    return ok(new Confidence(value));
  }

  equals(other: Confidence): boolean {
    return this.value === other.value;
  }
}
