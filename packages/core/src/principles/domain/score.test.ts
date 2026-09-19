import { describe, expect, it } from "bun:test";
import {
  InvalidScoreError,
  MAXIMUM_SCORE,
  MINIMUM_SCORE,
  Score,
} from "./score.ts";

describe("Score", () => {
  it("exposes 0 and 100 as the inclusive bounds", () => {
    expect(MINIMUM_SCORE).toBe(0);
    expect(MAXIMUM_SCORE).toBe(100);
  });

  it.each([MINIMUM_SCORE, 1, 50, 99, MAXIMUM_SCORE])(
    "accepts %p, which is within bounds",
    (value) => {
      expect(Score.of(value).value).toBe(value);
    },
  );

  it.each([MINIMUM_SCORE - 1, MAXIMUM_SCORE + 1, -100, 1_000])(
    "rejects %p, which is out of bounds",
    (value) => {
      expect(() => Score.of(value)).toThrow(
        new InvalidScoreError("Score must be between 0 and 100."),
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects %p, which is not finite",
    (value) => {
      expect(() => Score.of(value)).toThrow(
        new InvalidScoreError("Score must be a finite number."),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(() => Score.of(-1)).toThrow(InvalidScoreError);
    expect(new InvalidScoreError("boom").name).toBe("InvalidScoreError");
  });

  it("is equal to another score with the same value", () => {
    expect(Score.of(42).equals(Score.of(42))).toBe(true);
  });

  it("is not equal to another score with a different value", () => {
    expect(Score.of(42).equals(Score.of(43))).toBe(false);
  });
});
