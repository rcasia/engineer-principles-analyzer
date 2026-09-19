export const MINIMUM_SCORE = 0;
export const MAXIMUM_SCORE = 100;

export class InvalidScoreError extends Error {
  override readonly name = "InvalidScoreError";
}

/**
 * A normalised result of evaluating a subject against a principle.
 *
 * Immutable value object: the only way to obtain one is {@link Score.of},
 * so an out-of-range score cannot exist anywhere in the domain.
 */
export class Score {
  private constructor(readonly value: number) {}

  static of(value: number): Score {
    if (!Number.isFinite(value)) {
      throw new InvalidScoreError("Score must be a finite number.");
    }

    if (value < MINIMUM_SCORE || value > MAXIMUM_SCORE) {
      throw new InvalidScoreError(
        `Score must be between ${MINIMUM_SCORE} and ${MAXIMUM_SCORE}.`,
      );
    }

    return new Score(value);
  }

  equals(other: Score): boolean {
    return this.value === other.value;
  }
}
