import type { Projection } from "../../eventsourcing/application/projection.port.ts";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import type { FindingStatus } from "../domain/finding-state.ts";
import {
  FINDING_ACCEPTED_EVENT,
  FINDING_DETECTED_EVENT,
  FINDING_REOPENED_EVENT,
  FINDING_RESOLVED_EVENT,
  FINDING_SUPPRESSED_EVENT,
  type FindingAcceptedPayload,
  type FindingDetectedPayload,
  type FindingResolvedPayload,
  type FindingSuppressedPayload,
} from "../domain/finding-event.ts";

/**
 * The query-side read model for one finding (#26 "read models are
 * projections of events and are disposable/rebuildable"): what the
 * finding's event stream says, without touching the write side.
 *
 * Carries the same references the events carry — ids, versions, location
 * facts — and nothing else. Rehydrating this view can never resurrect
 * source, because the stream never held any.
 */
export interface FindingView {
  readonly findingId: string | undefined;
  readonly ruleId: string | undefined;
  readonly ruleVersion: string | undefined;
  readonly status: "nonexistent" | FindingStatus;
  readonly suppression:
    | {
        readonly reason: string;
        readonly suppressedBy: string | undefined;
        readonly expiresAt: string | undefined;
      }
    | undefined;
  /** How many lifecycle events have been applied: the auditable history length. */
  readonly eventCount: number;
}

export const INITIAL_FINDING_VIEW: FindingView = {
  findingId: undefined,
  ruleId: undefined,
  ruleVersion: undefined,
  status: "nonexistent",
  suppression: undefined,
  eventCount: 0,
};

export class FindingProjection implements Projection<FindingView> {
  readonly initial: FindingView = INITIAL_FINDING_VIEW;

  apply(readModel: FindingView, event: EventEnvelope): FindingView {
    switch (event.eventType) {
      case FINDING_DETECTED_EVENT: {
        const payload = event.payload as FindingDetectedPayload;
        return {
          findingId: payload.findingId,
          ruleId: payload.ruleId,
          ruleVersion: payload.ruleVersion,
          status: "open",
          suppression: undefined,
          eventCount: readModel.eventCount + 1,
        };
      }
      case FINDING_ACCEPTED_EVENT: {
        const payload = event.payload as FindingAcceptedPayload;
        return {
          ...readModel,
          findingId: payload.findingId,
          status: "accepted",
          eventCount: readModel.eventCount + 1,
        };
      }
      case FINDING_SUPPRESSED_EVENT: {
        const payload = event.payload as FindingSuppressedPayload;
        return {
          ...readModel,
          findingId: payload.findingId,
          status: "suppressed",
          suppression: {
            reason: payload.reason,
            suppressedBy: payload.suppressedBy,
            expiresAt: payload.expiresAt,
          },
          eventCount: readModel.eventCount + 1,
        };
      }
      case FINDING_RESOLVED_EVENT: {
        const payload = event.payload as FindingResolvedPayload;
        return {
          ...readModel,
          findingId: payload.findingId,
          status: "resolved",
          suppression: undefined,
          eventCount: readModel.eventCount + 1,
        };
      }
      case FINDING_REOPENED_EVENT: {
        const payload = event.payload as { readonly findingId: string };
        return {
          ...readModel,
          findingId: payload.findingId,
          status: "open",
          suppression: undefined,
          eventCount: readModel.eventCount + 1,
        };
      }
      default:
        return readModel;
    }
  }
}
