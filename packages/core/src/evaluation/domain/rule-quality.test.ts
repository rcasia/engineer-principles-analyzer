import { describe, expect, it } from "bun:test";
import {
  InvalidEvaluationCountsError,
  summarizeRuleQuality,
} from "./rule-quality.ts";

describe("summarizeRuleQuality", () => {
  it("derives precision, recall and error rates from confusion counts", () => {
    expect(
      summarizeRuleQuality({
        truePositives: 80,
        falsePositives: 20,
        trueNegatives: 70,
        falseNegatives: 30,
      }),
    ).toEqual({
      precision: 0.8,
      recall: 80 / 110,
      falsePositiveRate: 20 / 90,
      falseNegativeRate: 30 / 110,
    });
  });

  it("reports perfect and perfectly wrong judgments exactly", () => {
    expect(
      summarizeRuleQuality({
        truePositives: 10,
        falsePositives: 0,
        trueNegatives: 10,
        falseNegatives: 0,
      }),
    ).toEqual({
      precision: 1,
      recall: 1,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
    });

    expect(
      summarizeRuleQuality({
        truePositives: 0,
        falsePositives: 10,
        trueNegatives: 0,
        falseNegatives: 10,
      }),
    ).toEqual({
      precision: 0,
      recall: 0,
      falsePositiveRate: 1,
      falseNegativeRate: 1,
    });
  });

  it("returns null instead of a misleading zero with no predictions", () => {
    expect(
      summarizeRuleQuality({
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 50,
        falseNegatives: 50,
      }),
    ).toEqual({
      precision: null,
      recall: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 1,
    });
  });

  it("returns null for every rate on an empty sample", () => {
    expect(
      summarizeRuleQuality({
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
      }),
    ).toEqual({
      precision: null,
      recall: null,
      falsePositiveRate: null,
      falseNegativeRate: null,
    });
  });

  it.each([
    ["truePositives", -1],
    ["falsePositives", -5],
    ["trueNegatives", -100],
    ["falseNegatives", -2],
  ])("rejects a negative %s of %p", (name, value) => {
    expect(() =>
      summarizeRuleQuality({
        truePositives: 1,
        falsePositives: 1,
        trueNegatives: 1,
        falseNegatives: 1,
        [name]: value,
      }),
    ).toThrow(
      new InvalidEvaluationCountsError(
        `${name} must be a non-negative integer.`,
      ),
    );
  });

  it.each([Number.NaN, 1.5, Number.POSITIVE_INFINITY])(
    "rejects a non-integer count of %p",
    (value) => {
      expect(() =>
        summarizeRuleQuality({
          truePositives: value,
          falsePositives: 0,
          trueNegatives: 0,
          falseNegatives: 0,
        }),
      ).toThrow(
        new InvalidEvaluationCountsError(
          "truePositives must be a non-negative integer.",
        ),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidEvaluationCountsError("boom").name).toBe(
      "InvalidEvaluationCountsError",
    );
  });
});
