import { describe, expect, it } from "bun:test";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import {
  FINDING_ACCEPTED_EVENT,
  FINDING_DETECTED_EVENT,
  FINDING_REOPENED_EVENT,
  FINDING_RESOLVED_EVENT,
  FINDING_SUPPRESSED_EVENT,
} from "../domain/finding-event.ts";
import {
  FindingProjection,
  INITIAL_FINDING_VIEW,
} from "./finding.projection.ts";

function envelope(eventType: string, payload: unknown, sequence: number): EventEnvelope {
  return {
    eventId: `e-${sequence}`,
    eventType,
    eventVersion: 1,
    aggregateId: "finding-1",
    sequence,
    occurredAt: "2026-09-20T00:00:00.000Z",
    correlationId: "finding-1",
    causationId: `e-${sequence - 1}`,
    payload,
  };
}

function history(): EventEnvelope[] {
  return [
    envelope(
      FINDING_DETECTED_EVENT,
      {
        findingId: "finding-1",
        ruleId: "acme.no-console",
        ruleVersion: "1.2.0",
        filePath: "src/a.ts",
        startLine: 3,
        findingHash: "hash-abc",
      },
      1,
    ),
    envelope(
      FINDING_SUPPRESSED_EVENT,
      {
        findingId: "finding-1",
        reason: "false positive",
        suppressedBy: "ana",
        expiresAt: undefined,
      },
      2,
    ),
    envelope(
      FINDING_REOPENED_EVENT,
      { findingId: "finding-1", reason: "regressed" },
      3,
    ),
    envelope(
      FINDING_ACCEPTED_EVENT,
      { findingId: "finding-1", reason: "confirmed", acceptedBy: "bo" },
      4,
    ),
    envelope(
      FINDING_RESOLVED_EVENT,
      { findingId: "finding-1", reason: "fixed", resolvedBy: "bo" },
      5,
    ),
  ];
}

describe("FindingProjection", () => {
  it("starts from a nonexistent view with no history", () => {
    expect(new FindingProjection().initial).toEqual(INITIAL_FINDING_VIEW);
    expect(INITIAL_FINDING_VIEW.eventCount).toBe(0);
  });

  it("opens a finding on detection, keeping references only", () => {
    const view = new FindingProjection().apply(
      INITIAL_FINDING_VIEW,
      history()[0]!,
    );

    expect(view).toEqual({
      findingId: "finding-1",
      ruleId: "acme.no-console",
      ruleVersion: "1.2.0",
      status: "open",
      suppression: undefined,
      eventCount: 1,
    });
  });

  it("tracks suppression with its reason, then clears it on reopen", () => {
    const projection = new FindingProjection();
    const suppressed = history()
      .slice(0, 2)
      .reduce((view, event) => projection.apply(view, event), INITIAL_FINDING_VIEW);

    expect(suppressed.status).toBe("suppressed");
    expect(suppressed.suppression).toEqual({
      reason: "false positive",
      suppressedBy: "ana",
      expiresAt: undefined,
    });
    expect(suppressed.eventCount).toBe(2);

    const reopened = projection.apply(suppressed, history()[2]!);
    expect(reopened.status).toBe("open");
    expect(reopened.suppression).toBeUndefined();
    expect(reopened.eventCount).toBe(3);
  });

  it("rebuilds the full lifecycle by replay, counting every event", () => {
    const view = history().reduce(
      (readModel, event) => new FindingProjection().apply(readModel, event),
      INITIAL_FINDING_VIEW,
    );

    expect(view).toEqual({
      findingId: "finding-1",
      ruleId: "acme.no-console",
      ruleVersion: "1.2.0",
      status: "resolved",
      suppression: undefined,
      eventCount: 5,
    });
  });

  it("rebuilds deterministically: the same stream always gives the same view", () => {
    const events = history();
    const fold = () =>
      events.reduce(
        (readModel, event) => new FindingProjection().apply(readModel, event),
        new FindingProjection().initial,
      );

    expect(fold()).toEqual(fold());
  });

  it("ignores unknown event types, returning the same view", () => {
    const projection = new FindingProjection();
    const view = projection.apply(INITIAL_FINDING_VIEW, history()[0]!);

    expect(projection.apply(view, envelope("SomethingElse", {}, 9))).toBe(view);
  });
});
