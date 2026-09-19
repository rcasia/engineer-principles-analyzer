/**
 * How a result was produced, so a consumer never has to guess whether a
 * finding is a deterministic fact or a probabilistic judgment.
 *
 * - `deterministic` — a fixed procedure (parsing, static analysis) that
 *   returns the same verdict for the same input every time.
 * - `heuristic` — a rule of thumb or static approximation that can be wrong
 *   without any model being involved.
 * - `ai_assisted` — a language model contributed to the verdict.
 */
export const ANALYSIS_METHODS = [
  "deterministic",
  "heuristic",
  "ai_assisted",
] as const;

export type AnalysisMethod = (typeof ANALYSIS_METHODS)[number];

export function isAnalysisMethod(value: string): value is AnalysisMethod {
  return (ANALYSIS_METHODS as readonly string[]).includes(value);
}
