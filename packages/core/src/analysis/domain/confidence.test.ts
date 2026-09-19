import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  Confidence,
  InvalidConfidenceError,
  MAXIMUM_CONFIDENCE,
  MINIMUM_CONFIDENCE,
} from "./confidence.ts";

describe("Confidence", () => {
  it("exposes 0 and 1 as the inclusive bounds", () => {
    expect(MINIMUM_CONFIDENCE).toBe(0);
    expect(MAXIMUM_CONFIDENCE).toBe(1);
  });

  it.each([MINIMUM_CONFIDENCE, 0.01, 0.5, 0.99, MAXIMUM_CONFIDENCE])(
    "accepts %p, which is within bounds",
    (value) => {
      expect(unwrap(Confidence.of(value)).value).toBe(value);
    },
  );

  it.each([MINIMUM_CONFIDENCE - 0.01, MAXIMUM_CONFIDENCE + 0.01, -1, 100])(
    "rejects %p, which is out of bounds, as an error value rather than a throw",
    (value) => {
      expect(unwrapErr(Confidence.of(value))).toEqual(
        new InvalidConfidenceError("Confidence must be between 0 and 1."),
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects %p, which is not finite, as an error value rather than a throw",
    (value) => {
      expect(unwrapErr(Confidence.of(value))).toEqual(
        new InvalidConfidenceError("Confidence must be a finite number."),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(unwrapErr(Confidence.of(-1))).toBeInstanceOf(
      InvalidConfidenceError,
    );
    expect(new InvalidConfidenceError("boom").name).toBe(
      "InvalidConfidenceError",
    );
  });

  it("is equal to another confidence with the same value", () => {
    expect(
      unwrap(Confidence.of(0.5)).equals(unwrap(Confidence.of(0.5))),
    ).toBe(true);
  });

  it("is not equal to another confidence with a different value", () => {
    expect(
      unwrap(Confidence.of(0.5)).equals(unwrap(Confidence.of(0.6))),
    ).toBe(false);
  });
});
