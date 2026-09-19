/**
 * The outcome of evaluating one rule against one subject.
 *
 * Five states, not two, because a rule engine that can only say "pass" or
 * "fail" cannot represent the cases that actually happen once judgment is
 * probabilistic:
 *
 * - `compliant` — the rule's condition holds.
 * - `violation` — the rule's condition does not hold.
 * - `uncertain` — the analyzer could not reach a confident verdict.
 * - `not_applicable` — the rule does not apply to this subject (e.g. a
 *   language-specific rule evaluated against a different language).
 * - `unable_to_analyze` — the analyzer failed to run at all (parse error,
 *   timeout, unsupported input), which is not the same as `uncertain`.
 */
export const ANALYSIS_STATUSES = [
  "compliant",
  "violation",
  "uncertain",
  "not_applicable",
  "unable_to_analyze",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export function isAnalysisStatus(value: string): value is AnalysisStatus {
  return (ANALYSIS_STATUSES as readonly string[]).includes(value);
}
