import type { Decider } from "../../eventsourcing/domain/decider.ts";
import {
  FINDING_ACCEPTED_EVENT,
  FINDING_DETECTED_EVENT,
  FINDING_REOPENED_EVENT,
  FINDING_RESOLVED_EVENT,
  FINDING_SUPPRESSED_EVENT,
  type FindingEventPayload,
} from "../domain/finding-event.ts";
import type { FindingStatus } from "../domain/finding-state.ts";

export class InvalidFindingCommandError extends Error {
  override readonly name = "InvalidFindingCommandError";
}

export interface FindingSuppression {
  readonly reason: string;
  readonly suppressedBy: string | undefined;
  readonly expiresAt: string | undefined;
}

export interface FindingLifecycleState {
  readonly status: "nonexistent" | FindingStatus;
  readonly findingId: string | undefined;
  readonly ruleId: string | undefined;
  readonly ruleVersion: string | undefined;
  readonly suppression: FindingSuppression | undefined;
}

export const INITIAL_FINDING_STATE: FindingLifecycleState = {
  status: "nonexistent",
  findingId: undefined,
  ruleId: undefined,
  ruleVersion: undefined,
  suppression: undefined,
};

export type FindingCommand =
  | {
      readonly kind: "detect";
      readonly findingId: string;
      readonly ruleId: string;
      readonly ruleVersion?: string;
      readonly filePath?: string;
      readonly startLine?: number;
      readonly findingHash: string;
    }
  | { readonly kind: "accept"; readonly reason?: string; readonly acceptedBy?: string }
  | {
      readonly kind: "suppress";
      readonly reason: string;
      readonly suppressedBy?: string;
      readonly expiresAt?: string;
    }
  | { readonly kind: "resolve"; readonly reason?: string; readonly resolvedBy?: string }
  | { readonly kind: "reopen"; readonly reason?: string };

export interface FindingLifecycleEvent {
  readonly eventType: string;
  readonly payload: FindingEventPayload;
}

/**
 * The event-sourced aggregate for one finding (#26, #42): commands load
 * the aggregate history, validate invariants, and emit immutable events;
 * `evolve` folds them back into state. Both are pure — no storage, no
 * clock, no I/O — so any `EventStore` stream per finding id rehydrates
 * through `rehydrate` and any read model rebuilds from the same history.
 *
 * Suppression requires a reason: muting a finding without saying why
 * leaves an unauditable hole, and the decider refuses to dig one.
 */
export class FindingLifecycleDecider
  implements Decider<FindingLifecycleState, FindingCommand, FindingLifecycleEvent>
{
  readonly initialState: FindingLifecycleState = INITIAL_FINDING_STATE;

  decide(
    command: FindingCommand,
    state: FindingLifecycleState,
  ): readonly FindingLifecycleEvent[] {
    switch (command.kind) {
      case "detect":
        return [this.detect(command, state)];
      case "accept":
        return [this.accept(command, state)];
      case "suppress":
        return [this.suppress(command, state)];
      case "resolve":
        return [this.resolve(command, state)];
      case "reopen":
        return [this.reopen(command, state)];
    }
  }

  evolve(
    state: FindingLifecycleState,
    event: FindingLifecycleEvent,
  ): FindingLifecycleState {
    switch (event.eventType) {
      case FINDING_DETECTED_EVENT: {
        const payload = event.payload as {
          readonly findingId: string;
          readonly ruleId: string;
          readonly ruleVersion: string | undefined;
        };
        return {
          status: "open",
          findingId: payload.findingId,
          ruleId: payload.ruleId,
          ruleVersion: payload.ruleVersion,
          suppression: undefined,
        };
      }
      case FINDING_ACCEPTED_EVENT:
        return { ...state, status: "accepted" };
      case FINDING_SUPPRESSED_EVENT: {
        const payload = event.payload as {
          readonly reason: string;
          readonly suppressedBy: string | undefined;
          readonly expiresAt: string | undefined;
        };
        return {
          ...state,
          status: "suppressed",
          suppression: {
            reason: payload.reason,
            suppressedBy: payload.suppressedBy,
            expiresAt: payload.expiresAt,
          },
        };
      }
      case FINDING_RESOLVED_EVENT:
        return { ...state, status: "resolved", suppression: undefined };
      case FINDING_REOPENED_EVENT:
        return { ...state, status: "open", suppression: undefined };
      default:
        return state;
    }
  }

  private detect(
    command: Extract<FindingCommand, { kind: "detect" }>,
    state: FindingLifecycleState,
  ): FindingLifecycleEvent {
    if (state.status !== "nonexistent") {
      throw new InvalidFindingCommandError(
        `finding "${command.findingId}" already exists.`,
      );
    }
    if (command.findingId.trim().length === 0) {
      throw new InvalidFindingCommandError("findingId must not be empty.");
    }
    if (command.ruleId.trim().length === 0) {
      throw new InvalidFindingCommandError("ruleId must not be empty.");
    }
    if (command.findingHash.trim().length === 0) {
      throw new InvalidFindingCommandError("findingHash must not be empty.");
    }
    return {
      eventType: FINDING_DETECTED_EVENT,
      payload: {
        findingId: command.findingId,
        ruleId: command.ruleId,
        ruleVersion: command.ruleVersion,
        filePath: command.filePath,
        startLine: command.startLine,
        findingHash: command.findingHash,
      },
    };
  }

  private accept(
    command: Extract<FindingCommand, { kind: "accept" }>,
    state: FindingLifecycleState,
  ): FindingLifecycleEvent {
    const findingId = this.requireStatus(state, "accepting", ["open"]);
    return {
      eventType: FINDING_ACCEPTED_EVENT,
      payload: {
        findingId,
        reason: command.reason,
        acceptedBy: command.acceptedBy,
      },
    };
  }

  private suppress(
    command: Extract<FindingCommand, { kind: "suppress" }>,
    state: FindingLifecycleState,
  ): FindingLifecycleEvent {
    const findingId = this.requireStatus(state, "suppressing", ["open", "accepted"]);
    if (command.reason.trim().length === 0) {
      throw new InvalidFindingCommandError(
        "suppression reason must not be empty.",
      );
    }
    return {
      eventType: FINDING_SUPPRESSED_EVENT,
      payload: {
        findingId,
        reason: command.reason,
        suppressedBy: command.suppressedBy,
        expiresAt: command.expiresAt,
      },
    };
  }

  private resolve(
    command: Extract<FindingCommand, { kind: "resolve" }>,
    state: FindingLifecycleState,
  ): FindingLifecycleEvent {
    const findingId = this.requireStatus(state, "resolving", [
      "open",
      "accepted",
      "suppressed",
    ]);
    return {
      eventType: FINDING_RESOLVED_EVENT,
      payload: {
        findingId,
        reason: command.reason,
        resolvedBy: command.resolvedBy,
      },
    };
  }

  private reopen(
    command: Extract<FindingCommand, { kind: "reopen" }>,
    state: FindingLifecycleState,
  ): FindingLifecycleEvent {
    const findingId = this.requireStatus(state, "reopening", [
      "accepted",
      "suppressed",
      "resolved",
    ]);
    return {
      eventType: FINDING_REOPENED_EVENT,
      payload: { findingId, reason: command.reason },
    };
  }

  private requireStatus(
    state: FindingLifecycleState,
    verb: string,
    allowed: readonly FindingStatus[],
  ): string {
    // "nonexistent" needs no special case: it never appears in `allowed`,
    // so the membership check below already rejects it. The cast only
    // recovers the narrowing the removed disjunct used to provide.
    if (!allowed.includes(state.status as FindingStatus)) {
      throw new InvalidFindingCommandError(
        `cannot ${verb} a finding that is "${state.status}".`,
      );
    }
    return state.findingId as string;
  }
}
