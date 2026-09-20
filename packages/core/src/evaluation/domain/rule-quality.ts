/**
 * Engine-quality metrics (#30): how good Principled's own judgments are.
 *
 * These are measurements of the analyzer, not product-usage analytics. They
 * are computed from controlled evaluation corpora — synthetic, public or
 * explicitly authorized data — and never require tracking individual users
 * or retaining customer source code (#28).
 *
 * Every rate is `null` when its denominator is zero: "not measurable from
 * this sample", never a silent zero that would read as perfect or useless.
 */

export interface ConfusionCounts {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly trueNegatives: number;
  readonly falseNegatives: number;
}

export interface RuleQuality {
  /** `TP / (TP + FP)`, or `null` with no positive predictions. */
  readonly precision: number | null;
  /** `TP / (TP + FN)`, or `null` with no actual positives. */
  readonly recall: number | null;
  /** `FP / (FP + TN)`, or `null` with no actual negatives. */
  readonly falsePositiveRate: number | null;
  /** `FN / (FN + TP)`, or `null` with no actual positives. */
  readonly falseNegativeRate: number | null;
}

export class InvalidEvaluationCountsError extends Error {
  override readonly name = "InvalidEvaluationCountsError";
}

function requireCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidEvaluationCountsError(
      `${name} must be a non-negative integer.`,
    );
  }
}

function rateOf(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

/**
 * Derives precision, recall and error rates from one rule's confusion
 * counts in one language. Counts must be non-negative integers — a
 * fractional or negative count is a caller bug, not a measurement.
 */
export function summarizeRuleQuality(counts: ConfusionCounts): RuleQuality {
  requireCount(counts.truePositives, "truePositives");
  requireCount(counts.falsePositives, "falsePositives");
  requireCount(counts.trueNegatives, "trueNegatives");
  requireCount(counts.falseNegatives, "falseNegatives");

  const predictedPositive = counts.truePositives + counts.falsePositives;
  const actualPositive = counts.truePositives + counts.falseNegatives;
  const actualNegative = counts.falsePositives + counts.trueNegatives;

  return {
    precision: rateOf(counts.truePositives, predictedPositive),
    recall: rateOf(counts.truePositives, actualPositive),
    falsePositiveRate: rateOf(counts.falsePositives, actualNegative),
    falseNegativeRate: rateOf(counts.falseNegatives, actualPositive),
  };
}
