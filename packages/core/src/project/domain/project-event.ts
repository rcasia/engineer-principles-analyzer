/**
 * The facts a project-level analysis run can hold in its event stream
 * (#22 "Event sourcing", #33): a request, and — for every project rule that
 * was run — exactly one of a completion or a failure.
 *
 * Repository/project state is a projection of these events, not the
 * canonical store: replays rebuild project findings and architecture views
 * from this stream (see `application/project.projection.ts`).
 *
 * No payload carries `sourceCode` or any excerpt of it — only counts, paths,
 * languages and identifiers — so the immutable event history never becomes a
 * permanent copy of customer source (ADR-0012 "Sensitive customer data").
 * Repository artifacts live separately under explicit retention controls
 * (see `domain/retention-policy.ts` and the artifact-store port).
 */
export const PROJECT_ANALYSIS_REQUESTED_EVENT = "ProjectAnalysisRequested";
export const PROJECT_ANALYSIS_COMPLETED_EVENT = "ProjectAnalysisCompleted";
export const PROJECT_ANALYSIS_FAILED_EVENT = "ProjectAnalysisFailed";

export interface ProjectAnalysisRequestedPayload {
  readonly fileCount: number;
  readonly languages: readonly string[];
  /** Repository-relative paths. Paths are identity, not content. */
  readonly filePaths: readonly string[];
  readonly ruleIds: readonly string[];
}

export interface ProjectAnalysisCompletedPayload {
  readonly ruleId: string;
  readonly fileCount: number;
  readonly analyzedFileCount: number;
  readonly graphCoverage: number;
  readonly status: string;
  readonly method: string;
  readonly confidence: number;
}

export interface ProjectAnalysisFailedPayload {
  readonly ruleId: string;
  readonly reason: string;
}

export type ProjectEventPayload =
  | ProjectAnalysisRequestedPayload
  | ProjectAnalysisCompletedPayload
  | ProjectAnalysisFailedPayload;
