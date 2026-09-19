import type { AnalysisMethod } from "../../analysis/domain/analysis-method.ts";
import type { AnalysisStatus } from "../../analysis/domain/analysis-status.ts";

/**
 * The facts the rule engine's event stream can hold about one run, per the
 * event-sourcing baseline (ADR-0012, #33): a request, and — for every rule
 * that was run — exactly one of a completion or a failure.
 *
 * This is also the mechanism `AnalyzeSubject` uses to satisfy #9's "the
 * engine can distinguish rule failures from uncertain judgments": a rule
 * that runs to completion and reports `"uncertain"` produces an
 * {@link AnalysisCompletedPayload} (it did its job, however hedged); a rule
 * that throws, rejects, or returns something that is not a valid
 * `AnalysisResult` produces an {@link AnalysisFailedPayload} instead — the
 * engine never had a verdict to report at all.
 *
 * Deliberately not a full `Decider`/aggregate (see
 * `eventsourcing/domain/decider.ts`): building the event-sourced aggregate
 * that owns this stream and actually appends it to an `EventStore` is #34's
 * job. This slice only produces events shaped for that aggregate to
 * eventually consume and replay — `AnalyzeSubject` never appends anything
 * itself (#9's "must not require persistence").
 *
 * No payload carries `sourceCode` or any excerpt of it — only identifiers
 * and the already-minimized facts `AnalysisResult` itself exposes — so the
 * event stream cannot become a second place customer source ends up stored
 * (#28, #33 "Sensitive data").
 */
export const ANALYSIS_REQUESTED_EVENT = "AnalysisRequested";
export const ANALYSIS_COMPLETED_EVENT = "AnalysisCompleted";
export const ANALYSIS_FAILED_EVENT = "AnalysisFailed";

export interface AnalysisRequestedPayload {
  readonly language: string;
  readonly ruleIds: readonly string[];
}

export interface AnalysisCompletedPayload {
  readonly ruleId: string;
  readonly language: string;
  readonly status: AnalysisStatus;
  readonly method: AnalysisMethod;
  readonly confidence: number;
}

export interface AnalysisFailedPayload {
  readonly ruleId: string;
  readonly language: string;
  readonly reason: string;
}

export type AnalysisEventPayload =
  | AnalysisRequestedPayload
  | AnalysisCompletedPayload
  | AnalysisFailedPayload;
