import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import type { EventEnvelope } from "../../eventsourcing/domain/event.ts";
import { InMemoryEventStore } from "../../eventsourcing/infrastructure/in-memory-event-store.ts";
import { Projector } from "../../eventsourcing/application/projector.ts";
import { unwrap } from "../../shared/result.ts";
import { Subject } from "../domain/subject.ts";
import { InMemoryRuleCatalog } from "../infrastructure/in-memory-rule-catalog.ts";
import type { Rule } from "./rule.port.ts";
import { AnalyzeSubject } from "./analyze-subject.use-case.ts";
import {
  AnalysisRunProjection,
  INITIAL_ANALYSIS_RUN_VIEW,
  type AnalysisRunView,
} from "./analysis-run.projection.ts";

const analyzer = { name: "fake-analyzer", version: "0.0.0" };

function envelope<TPayload>(
  overrides: Partial<EventEnvelope<TPayload>> & {
    eventType: string;
    payload: TPayload;
  },
): EventEnvelope<TPayload> {
  return {
    eventId: "event-1",
    eventVersion: 1,
    aggregateId: "run-1",
    sequence: 1,
    occurredAt: "2026-01-01T00:00:00.000Z",
    correlationId: "run-1",
    causationId: "run-1",
    ...overrides,
  };
}

describe("AnalysisRunProjection", () => {
  it("starts from a pending run with nothing known yet", () => {
    const projection = new AnalysisRunProjection();

    expect(projection.initial).toEqual(INITIAL_ANALYSIS_RUN_VIEW);
    expect(projection.initial).toEqual({
      analysisId: undefined,
      language: undefined,
      requestedRuleIds: [],
      status: "pending",
      outcomes: [],
    });
  });

  it("records the analysisId, language and requested rule ids from AnalysisRequested", () => {
    const projection = new AnalysisRunProjection();

    const view = projection.apply(
      projection.initial,
      envelope({
        eventType: "AnalysisRequested",
        correlationId: "run-42",
        payload: { language: "typescript", ruleIds: ["solid.srp", "solid.ocp"] },
      }),
    );

    expect(view.analysisId).toBe("run-42");
    expect(view.language).toBe("typescript");
    expect(view.requestedRuleIds).toEqual(["solid.srp", "solid.ocp"]);
    expect(view.status).toBe("pending");
  });

  it("is already completed when AnalysisRequested selects no rules", () => {
    const projection = new AnalysisRunProjection();

    const view = projection.apply(
      projection.initial,
      envelope({
        eventType: "AnalysisRequested",
        payload: { language: "typescript", ruleIds: [] },
      }),
    );

    expect(view.status).toBe("completed");
  });

  it("stays pending after one of two requested rules completes", () => {
    const projection = new AnalysisRunProjection();
    const requested = projection.apply(
      projection.initial,
      envelope({
        eventType: "AnalysisRequested",
        payload: { language: "typescript", ruleIds: ["solid.srp", "solid.ocp"] },
      }),
    );

    const view = projection.apply(
      requested,
      envelope({
        eventType: "AnalysisCompleted",
        payload: {
          ruleId: "solid.srp",
          language: "typescript",
          status: "compliant",
          method: "deterministic",
          confidence: 1,
        },
      }),
    );

    expect(view.status).toBe("pending");
    expect(view.outcomes).toEqual([
      {
        ruleId: "solid.srp",
        outcome: "completed",
        status: "compliant",
        method: "deterministic",
        confidence: 1,
      },
    ]);
  });

  it("becomes completed once every requested rule has settled", () => {
    const projection = new AnalysisRunProjection();
    let view = projection.apply(
      projection.initial,
      envelope({
        eventType: "AnalysisRequested",
        payload: { language: "typescript", ruleIds: ["solid.srp", "solid.ocp"] },
      }),
    );

    view = projection.apply(
      view,
      envelope({
        eventType: "AnalysisCompleted",
        payload: {
          ruleId: "solid.srp",
          language: "typescript",
          status: "compliant",
          method: "deterministic",
          confidence: 1,
        },
      }),
    );

    view = projection.apply(
      view,
      envelope({
        eventType: "AnalysisFailed",
        payload: {
          ruleId: "solid.ocp",
          language: "typescript",
          reason: "boom",
        },
      }),
    );

    expect(view.status).toBe("completed");
    expect(view.outcomes).toEqual([
      {
        ruleId: "solid.srp",
        outcome: "completed",
        status: "compliant",
        method: "deterministic",
        confidence: 1,
      },
      { ruleId: "solid.ocp", outcome: "failed", reason: "boom" },
    ]);
  });

  it("leaves the read model unchanged for an event it does not recognise", () => {
    const projection = new AnalysisRunProjection();
    const before: AnalysisRunView = projection.initial;

    const after = projection.apply(
      before,
      envelope({ eventType: "SomethingElse", payload: {} }),
    );

    expect(after).toBe(before);
  });

  it("replays a real AnalyzeSubject run end to end through a real EventStore", async () => {
    const compliant: Rule = {
      id: "fake.always-compliant",
      evaluate: async () =>
        unwrap(
          AnalysisResult.of({
            ruleId: "fake.always-compliant",
            status: "compliant",
            confidence: unwrap(Confidence.of(1)),
            method: "deterministic",
            evidence: [],
            explanation: "Arbitrary placeholder rule: always compliant.",
            language: "typescript",
            analyzer,
            humanReviewRecommended: false,
          }),
        ),
    };
    const throws: Rule = {
      id: "fake.throws",
      evaluate: () => {
        throw new Error("boom");
      },
    };

    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([compliant, throws]),
    );
    const subject = unwrap(
      Subject.of({ sourceCode: "class Foo {}", language: "typescript" }),
    );

    const run = await engine.execute({ subject });

    const store = new InMemoryEventStore();
    await store.append(run.analysisId, 0, run.events);

    const history = await store.read(run.analysisId);
    const projector = new Projector(new AnalysisRunProjection());
    const view = projector.rebuild(history);

    expect(view.analysisId).toBe(run.analysisId);
    expect(view.language).toBe("typescript");
    expect(view.status).toBe("completed");
    expect(view.requestedRuleIds).toEqual([
      "fake.always-compliant",
      "fake.throws",
    ]);
    expect(view.outcomes).toEqual([
      {
        ruleId: "fake.always-compliant",
        outcome: "completed",
        status: "compliant",
        method: "deterministic",
        confidence: 1,
      },
      { ruleId: "fake.throws", outcome: "failed", reason: "boom" },
    ]);
  });
});
