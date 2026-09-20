import { describe, expect, it } from "bun:test";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import {
  PROJECT_ANALYSIS_COMPLETED_EVENT,
  PROJECT_ANALYSIS_FAILED_EVENT,
  PROJECT_ANALYSIS_REQUESTED_EVENT,
} from "../domain/project-event.ts";
import {
  INITIAL_PROJECT_ANALYSIS_VIEW,
  ProjectAnalysisProjection,
} from "./project.projection.ts";

function requested(): EventEnvelope {
  return {
    eventId: "e-1",
    eventType: PROJECT_ANALYSIS_REQUESTED_EVENT,
    eventVersion: 1,
    aggregateId: "analysis-1",
    sequence: 1,
    occurredAt: "2026-09-20T00:00:00.000Z",
    correlationId: "analysis-1",
    causationId: "analysis-1",
    payload: {
      fileCount: 3,
      languages: ["typescript"],
      filePaths: ["a.ts", "b.ts", "c.ts"],
      ruleIds: ["test.compliant", "test.throwing"],
    },
  };
}

function completed(): EventEnvelope {
  return {
    eventId: "e-2",
    eventType: PROJECT_ANALYSIS_COMPLETED_EVENT,
    eventVersion: 1,
    aggregateId: "analysis-1",
    sequence: 2,
    occurredAt: "2026-09-20T00:00:01.000Z",
    correlationId: "analysis-1",
    causationId: "e-1",
    payload: {
      ruleId: "test.compliant",
      fileCount: 3,
      analyzedFileCount: 3,
      graphCoverage: 1,
      status: "compliant",
      method: "heuristic",
      confidence: 0.5,
    },
  };
}

function failed(): EventEnvelope {
  return {
    eventId: "e-3",
    eventType: PROJECT_ANALYSIS_FAILED_EVENT,
    eventVersion: 1,
    aggregateId: "analysis-1",
    sequence: 3,
    occurredAt: "2026-09-20T00:00:02.000Z",
    correlationId: "analysis-1",
    causationId: "e-1",
    payload: { ruleId: "test.throwing", reason: "boom" },
  };
}

describe("project analysis event names", () => {
  it("keeps the stable ProjectAnalysis* names the use-case and projection share", () => {
    expect(PROJECT_ANALYSIS_REQUESTED_EVENT).toBe("ProjectAnalysisRequested");
    expect(PROJECT_ANALYSIS_COMPLETED_EVENT).toBe("ProjectAnalysisCompleted");
    expect(PROJECT_ANALYSIS_FAILED_EVENT).toBe("ProjectAnalysisFailed");
  });
});

describe("ProjectAnalysisProjection", () => {
  it("starts from an empty pending view", () => {
    expect(new ProjectAnalysisProjection().initial).toEqual(
      INITIAL_PROJECT_ANALYSIS_VIEW,
    );
    expect(INITIAL_PROJECT_ANALYSIS_VIEW).toEqual({
      analysisId: undefined,
      fileCount: undefined,
      languages: [],
      requestedRuleIds: [],
      status: "pending",
      outcomes: [],
    });
  });

  it("records the request and stays pending until every rule settles", () => {
    const projection = new ProjectAnalysisProjection();
    const afterRequest = projection.apply(INITIAL_PROJECT_ANALYSIS_VIEW, requested());

    expect(afterRequest).toEqual({
      analysisId: "analysis-1",
      fileCount: 3,
      languages: ["typescript"],
      requestedRuleIds: ["test.compliant", "test.throwing"],
      status: "pending",
      outcomes: [],
    });

    const afterOne = projection.apply(afterRequest, completed());
    expect(afterOne.status).toBe("pending");
    expect(afterOne.outcomes).toEqual([
      {
        ruleId: "test.compliant",
        outcome: "completed",
        status: "compliant",
        method: "heuristic",
        confidence: 0.5,
        graphCoverage: 1,
      },
    ]);
  });

  it("completes once every requested rule has settled", () => {
    const projection = new ProjectAnalysisProjection();
    const view = [requested(), completed(), failed()].reduce(
      (readModel, event) => projection.apply(readModel, event),
      INITIAL_PROJECT_ANALYSIS_VIEW,
    );

    expect(view.status).toBe("completed");
    expect(view.outcomes).toEqual([
      {
        ruleId: "test.compliant",
        outcome: "completed",
        status: "compliant",
        method: "heuristic",
        confidence: 0.5,
        graphCoverage: 1,
      },
      { ruleId: "test.throwing", outcome: "failed", reason: "boom" },
    ]);
  });

  it("ignores unknown event types, returning the same view", () => {
    const projection = new ProjectAnalysisProjection();
    const view = projection.apply(INITIAL_PROJECT_ANALYSIS_VIEW, requested());
    const unknown: EventEnvelope = { ...requested(), eventType: "SomethingElse" };

    expect(projection.apply(view, unknown)).toBe(view);
  });

  it("rebuilds deterministically: replaying the same stream gives the same view", () => {
    const projection = new ProjectAnalysisProjection();
    const events = [requested(), completed(), failed()];

    const first = events.reduce(
      (readModel, event) => projection.apply(readModel, event),
      INITIAL_PROJECT_ANALYSIS_VIEW,
    );
    const second = events.reduce(
      (readModel, event) => projection.apply(readModel, event),
      projection.initial,
    );

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).not.toContain("secret");
  });
});
