import { err, ok, type Result } from "../../shared/result.ts";
import type { AnalysisStatus } from "../../analysis/domain/analysis-status.ts";

/**
 * Maps one Jev Noul probability to an `AnalysisStatus` plus the confidence
 * the rule reports for it. Pure, so the policy — where the cutoffs sit and
 * how confidence is derived — is tested without any network involved.
 *
 * The cutoffs are reasoned starting defaults, not measured ones: a Noul near
 * 0.5 means similar probability for yes and no, so the middle band stays
 * `uncertain` and only the tails claim anything. Tuning them against the
 * versioned corpus (#27) is a rule-version bump, not a contract change.
 */
export class InvalidNoulValueError extends Error {
  override readonly name = "InvalidNoulValueError";
}

/** A Noul at or above this is read as a violation. */
export const VIOLATION_AT_OR_ABOVE = 0.75;

/** A Noul at or below this is read as compliant. */
export const COMPLIANT_AT_OR_BELOW = 0.25;

/**
 * Highest confidence an AI verdict may report. A single probability pushed
 * through fixed cutoffs carries threshold uncertainty the model never
 * reported, so v1 never claims more than this (#28: never present AI
 * findings as deterministic facts).
 */
export const MAXIMUM_AI_CONFIDENCE = 0.9;

export interface NoulVerdict {
  readonly status: Extract<
    AnalysisStatus,
    "violation" | "uncertain" | "compliant"
  >;
  readonly confidence: number;
}

export function toNoulVerdict(
  value: number,
): Result<NoulVerdict, InvalidNoulValueError> {
  if (!Number.isFinite(value)) {
    return err(
      new InvalidNoulValueError("Noul value must be a finite number."),
    );
  }

  if (value < 0 || value > 1) {
    return err(
      new InvalidNoulValueError("Noul value must be between 0 and 1."),
    );
  }

  if (value >= VIOLATION_AT_OR_ABOVE) {
    return ok({ status: "violation", confidence: aiConfidence(value) });
  }

  if (value <= COMPLIANT_AT_OR_BELOW) {
    return ok({ status: "compliant", confidence: aiConfidence(value) });
  }

  return ok({ status: "uncertain", confidence: aiConfidence(value) });
}

/**
 * Distance from maximum indecision, scaled to `[0, 1]` and capped: a 0.75
 * Noul reports 0.5 confidence, a dead-certain 0 or 1 reports the
 * `MAXIMUM_AI_CONFIDENCE` cap rather than full certainty.
 */
function aiConfidence(value: number): number {
  return Math.min(MAXIMUM_AI_CONFIDENCE, Math.abs(value - 0.5) * 2);
}
