/**
 * Identifies which analyzer produced a result, and at what version.
 *
 * Kept separate from {@link AnalysisMethod}: `method` says *how* a verdict
 * was reached (deterministic, heuristic, AI-assisted); `analyzer` says
 * *which* implementation reached it. Both are needed to reproduce or
 * challenge a finding, and to attribute it in an evaluation snapshot (#30).
 */
export interface AnalyzerMetadata {
  readonly name: string;
  readonly version: string;
}
