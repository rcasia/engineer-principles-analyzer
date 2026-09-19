import type { AnalysisMethod } from "../../analysis/domain/analysis-method.ts";
import type { AnalysisStatus } from "../../analysis/domain/analysis-status.ts";
import type { Projection } from "../../eventsourcing/application/projection.port.ts";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import {
  ANALYSIS_COMPLETED_EVENT,
  ANALYSIS_FAILED_EVENT,
  ANALYSIS_REQUESTED_EVENT,
  type AnalysisCompletedPayload,
  type AnalysisFailedPayload,
  type AnalysisRequestedPayload,
} from "../domain/analysis-event.ts";

/** One rule's outcome as rehydrated from its `AnalysisCompleted` event. */
export interface CompletedRuleOutcome {
  readonly ruleId: string;
  readonly outcome: "completed";
  readonly status: AnalysisStatus;
  readonly method: AnalysisMethod;
  readonly confidence: number;
}

/** One rule's outcome as rehydrated from its `AnalysisFailed` event. */
export interface FailedRuleOutcome {
  readonly ruleId: string;
  readonly outcome: "failed";
  readonly reason: string;
}

export type RuleOutcomeView = CompletedRuleOutcome | FailedRuleOutcome;

export type AnalysisRunStatus = "pending" | "completed";

/**
 * The query-side read model for one analysis run: what a stream of
 * `AnalysisRequested`/`AnalysisCompleted`/`AnalysisFailed` events (#9) says
 * happened, without re-running anything.
 *
 * Deliberately does not carry `explanation`, `evidence`, `remediation` or
 * any excerpt of the subject: none of that ever left the synchronous
 * `AnalysisResult` values `AnalyzeSubject.execute` returns directly — the
 * event payloads are already minimized to identifiers and facts (ADR-0013's
 * evidence-minimization requirement, #28). Rehydrating this view can
 * therefore never become a second place the submitted source, or any part
 * of it, ends up stored.
 */
export interface AnalysisRunView {
  /** `undefined` until the run's `AnalysisRequested` event has been applied. */
  readonly analysisId: string | undefined;
  readonly language: string | undefined;
  readonly requestedRuleIds: readonly string[];
  /** `"completed"` once every requested rule has produced a completion or a failure. */
  readonly status: AnalysisRunStatus;
  /** One entry per rule that has settled so far, in the order its event was applied. */
  readonly outcomes: readonly RuleOutcomeView[];
}

/** The read model before any event has been applied. */
export const INITIAL_ANALYSIS_RUN_VIEW: AnalysisRunView = {
  analysisId: undefined,
  language: undefined,
  requestedRuleIds: [],
  status: "pending",
  outcomes: [],
};

function statusFor(
  requestedRuleIds: readonly string[],
  outcomes: readonly RuleOutcomeView[],
): AnalysisRunStatus {
  return outcomes.length >= requestedRuleIds.length ? "completed" : "pending";
}

/**
 * Rehydrates {@link AnalysisRunView} from the engine's own event shapes
 * (ADR-0012 "Query side", #33) — the concrete replay this issue's ADR-0014
 * left as a risk with no passing test: "nothing yet appends
 * `AnalysisRun.events` anywhere ... deliberately deferred to #34".
 *
 * A caller (the web composition root, #34) appends `AnalyzeSubject`'s
 * `events` to a real `EventStore` under the run's `analysisId`, reads the
 * stream back, and folds it through this projection (directly or via
 * {@link Projector}) to get a queryable summary of what happened — without
 * this class ever touching an adapter itself.
 */
export class AnalysisRunProjection implements Projection<AnalysisRunView> {
  readonly initial: AnalysisRunView = INITIAL_ANALYSIS_RUN_VIEW;

  apply(readModel: AnalysisRunView, event: EventEnvelope): AnalysisRunView {
    switch (event.eventType) {
      case ANALYSIS_REQUESTED_EVENT: {
        const payload = event.payload as AnalysisRequestedPayload;
        const requestedRuleIds = payload.ruleIds;

        return {
          ...readModel,
          analysisId: event.correlationId,
          language: payload.language,
          requestedRuleIds,
          status: statusFor(requestedRuleIds, readModel.outcomes),
        };
      }
      case ANALYSIS_COMPLETED_EVENT: {
        const payload = event.payload as AnalysisCompletedPayload;
        const outcomes: readonly RuleOutcomeView[] = [
          ...readModel.outcomes,
          {
            ruleId: payload.ruleId,
            outcome: "completed",
            status: payload.status,
            method: payload.method,
            confidence: payload.confidence,
          },
        ];

        return {
          ...readModel,
          outcomes,
          status: statusFor(readModel.requestedRuleIds, outcomes),
        };
      }
      case ANALYSIS_FAILED_EVENT: {
        const payload = event.payload as AnalysisFailedPayload;
        const outcomes: readonly RuleOutcomeView[] = [
          ...readModel.outcomes,
          {
            ruleId: payload.ruleId,
            outcome: "failed",
            reason: payload.reason,
          },
        ];

        return {
          ...readModel,
          outcomes,
          status: statusFor(readModel.requestedRuleIds, outcomes),
        };
      }
      default:
        return readModel;
    }
  }
}
