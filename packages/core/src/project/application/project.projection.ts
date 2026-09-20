import type { Projection } from "../../eventsourcing/application/projection.port.ts";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import {
  PROJECT_ANALYSIS_COMPLETED_EVENT,
  PROJECT_ANALYSIS_FAILED_EVENT,
  PROJECT_ANALYSIS_REQUESTED_EVENT,
  type ProjectAnalysisCompletedPayload,
  type ProjectAnalysisFailedPayload,
  type ProjectAnalysisRequestedPayload,
} from "../domain/project-event.ts";

/** One project rule's outcome as rehydrated from its `ProjectAnalysisCompleted` event. */
export interface CompletedProjectRuleOutcome {
  readonly ruleId: string;
  readonly outcome: "completed";
  readonly status: string;
  readonly method: string;
  readonly confidence: number;
  readonly graphCoverage: number;
}

/** One project rule's outcome as rehydrated from its `ProjectAnalysisFailed` event. */
export interface FailedProjectRuleOutcome {
  readonly ruleId: string;
  readonly outcome: "failed";
  readonly reason: string;
}

export type ProjectRuleOutcomeView =
  | CompletedProjectRuleOutcome
  | FailedProjectRuleOutcome;

export type ProjectAnalysisStatus = "pending" | "completed";

/**
 * The query-side read model for one project analysis run (#22 "Repository/
 * project state is a projection of events, not the canonical store"):
 * what a stream of project events says happened, without re-running
 * anything. Replays rebuild project findings and architecture views from
 * this stream.
 *
 * Deliberately carries no source and no excerpts: the event payloads never
 * held any (see `domain/project-event.ts`), so rehydrating this view can
 * never become a second place hosted repository data ends up stored.
 */
export interface ProjectAnalysisView {
  /** `undefined` until the run's `ProjectAnalysisRequested` event has been applied. */
  readonly analysisId: string | undefined;
  readonly fileCount: number | undefined;
  readonly languages: readonly string[];
  readonly requestedRuleIds: readonly string[];
  /** `"completed"` once every requested rule has produced a completion or a failure. */
  readonly status: ProjectAnalysisStatus;
  /** One entry per rule that has settled so far, in the order its event was applied. */
  readonly outcomes: readonly ProjectRuleOutcomeView[];
}

/** The read model before any event has been applied. */
export const INITIAL_PROJECT_ANALYSIS_VIEW: ProjectAnalysisView = {
  analysisId: undefined,
  fileCount: undefined,
  languages: [],
  requestedRuleIds: [],
  status: "pending",
  outcomes: [],
};

function statusFor(
  requestedRuleIds: readonly string[],
  outcomes: readonly ProjectRuleOutcomeView[],
): ProjectAnalysisStatus {
  return outcomes.length >= requestedRuleIds.length ? "completed" : "pending";
}

export class ProjectAnalysisProjection implements Projection<ProjectAnalysisView> {
  readonly initial: ProjectAnalysisView = INITIAL_PROJECT_ANALYSIS_VIEW;

  apply(readModel: ProjectAnalysisView, event: EventEnvelope): ProjectAnalysisView {
    switch (event.eventType) {
      case PROJECT_ANALYSIS_REQUESTED_EVENT: {
        const payload = event.payload as ProjectAnalysisRequestedPayload;
        const requestedRuleIds = [...payload.ruleIds];

        return {
          ...readModel,
          analysisId: event.correlationId,
          fileCount: payload.fileCount,
          languages: [...payload.languages],
          requestedRuleIds,
          status: statusFor(requestedRuleIds, readModel.outcomes),
        };
      }
      case PROJECT_ANALYSIS_COMPLETED_EVENT: {
        const payload = event.payload as ProjectAnalysisCompletedPayload;
        const outcomes: readonly ProjectRuleOutcomeView[] = [
          ...readModel.outcomes,
          {
            ruleId: payload.ruleId,
            outcome: "completed",
            status: payload.status,
            method: payload.method,
            confidence: payload.confidence,
            graphCoverage: payload.graphCoverage,
          },
        ];

        return {
          ...readModel,
          outcomes,
          status: statusFor(readModel.requestedRuleIds, outcomes),
        };
      }
      case PROJECT_ANALYSIS_FAILED_EVENT: {
        const payload = event.payload as ProjectAnalysisFailedPayload;
        const outcomes: readonly ProjectRuleOutcomeView[] = [
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
