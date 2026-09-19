import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import { unwrap } from "../../shared/result.ts";
import { Subject } from "../domain/subject.ts";
import { InMemoryRuleCatalog } from "../infrastructure/in-memory-rule-catalog.ts";
import { AnalyzeSubject } from "./analyze-subject.use-case.ts";
import type { EngineInstrumentation } from "./instrumentation.port.ts";
import type { Rule } from "./rule.port.ts";

const analyzer = { name: "fake-analyzer", version: "0.0.0" };

const subject = unwrap(
  Subject.of({ sourceCode: "class Foo {}", language: "typescript" }),
);

function idSequence(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** A deterministic, arbitrary "GOOD" placeholder rule: always compliant. */
const alwaysCompliant: Rule = {
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

/** A deterministic, arbitrary "BAD" placeholder rule: always a violation. */
const alwaysViolation: Rule = {
  id: "fake.always-violation",
  evaluate: async () => {
    const location = unwrap(SourceLocation.of({ startLine: 1 }));
    const evidence = unwrap(
      Evidence.of({ location, excerpt: "class Foo {}" }),
    );

    return unwrap(
      AnalysisResult.of({
        ruleId: "fake.always-violation",
        status: "violation",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [evidence],
        explanation: "Arbitrary placeholder rule: always a violation.",
        language: "typescript",
        analyzer,
        humanReviewRecommended: false,
      }),
    );
  },
};

/** A rule that honestly cannot decide — a legitimate uncertain verdict, not a failure. */
const alwaysUncertain: Rule = {
  id: "fake.always-uncertain",
  evaluate: async () =>
    unwrap(
      AnalysisResult.of({
        ruleId: "fake.always-uncertain",
        status: "uncertain",
        confidence: unwrap(Confidence.of(0.3)),
        method: "ai_assisted",
        evidence: [],
        explanation: "Arbitrary placeholder rule: never sure.",
        language: "typescript",
        analyzer,
        humanReviewRecommended: true,
      }),
    ),
};

const throwsSynchronously: Rule = {
  id: "fake.throws",
  evaluate: () => {
    throw new Error("boom");
  },
};

const rejectsAsynchronously: Rule = {
  id: "fake.rejects",
  evaluate: async () => {
    throw new Error("kaboom");
  },
};

const violatesContract: Rule = {
  id: "fake.violates-contract",
  evaluate: async () => ({ status: "compliant" }) as unknown as AnalysisResult,
};

describe("AnalyzeSubject", () => {
  it("runs every rule in the catalog when no ruleIds are given", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant, alwaysViolation]);
    const engine = new AnalyzeSubject(catalog, {
      generateId: idSequence("id"),
    });

    const run = await engine.execute({ subject });

    expect(run.results.map((result) => result.ruleId)).toEqual([
      "fake.always-compliant",
      "fake.always-violation",
    ]);
    expect(run.results.map((result) => result.status)).toEqual([
      "compliant",
      "violation",
    ]);
  });

  it("runs only the selected ruleIds, in the order requested", async () => {
    const catalog = new InMemoryRuleCatalog([
      alwaysCompliant,
      alwaysViolation,
      alwaysUncertain,
    ]);
    const engine = new AnalyzeSubject(catalog, {
      generateId: idSequence("id"),
    });

    const run = await engine.execute({
      subject,
      ruleIds: ["fake.always-violation", "fake.always-compliant"],
    });

    expect(run.results.map((result) => result.ruleId)).toEqual([
      "fake.always-violation",
      "fake.always-compliant",
    ]);
    expect(run.results.map((result) => result.status)).toEqual([
      "violation",
      "compliant",
    ]);
  });

  it("keeps results in request order even when a later rule resolves first", async () => {
    const resultFor = (ruleId: string, explanation: string) =>
      unwrap(
        AnalysisResult.of({
          ruleId,
          status: "compliant",
          confidence: unwrap(Confidence.of(1)),
          method: "deterministic",
          evidence: [],
          explanation,
          language: "typescript",
          analyzer,
          humanReviewRecommended: false,
        }),
      );
    const slow: Rule = {
      id: "fake.slow",
      evaluate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return resultFor("fake.slow", "resolves after a delay");
      },
    };
    const fast: Rule = {
      id: "fake.fast",
      evaluate: async () => resultFor("fake.fast", "resolves immediately"),
    };
    const catalog = new InMemoryRuleCatalog([slow, fast]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.results.map((result) => result.ruleId)).toEqual([
      "fake.slow",
      "fake.fast",
    ]);
  });

  it("distinguishes a rule's own uncertain verdict from an engine-level failure", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysUncertain, throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog, {
      generateId: idSequence("id"),
    });

    const run = await engine.execute({ subject });

    const [uncertain, failed] = run.results;
    expect(uncertain?.status).toBe("uncertain");
    expect(uncertain?.humanReviewRecommended).toBe(true);
    expect(failed?.status).toBe("unable_to_analyze");

    const eventTypes = run.events.map((event) => event.eventType);
    expect(eventTypes).toEqual([
      "AnalysisRequested",
      "AnalysisCompleted",
      "AnalysisFailed",
    ]);
  });

  it("isolates a rule that throws synchronously", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant, throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.results).toHaveLength(2);
    const failure = run.results[1]!;
    expect(failure.status).toBe("unable_to_analyze");
    expect(failure.ruleId).toBe("fake.throws");
    expect(failure.humanReviewRecommended).toBe(true);
    expect(failure.explanation).toContain("boom");
  });

  it("isolates a rule that rejects asynchronously", async () => {
    const catalog = new InMemoryRuleCatalog([rejectsAsynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.results[0]?.explanation).toContain("kaboom");
  });

  it("isolates a rule that returns something that is not a genuine AnalysisResult", async () => {
    const catalog = new InMemoryRuleCatalog([violatesContract]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.results[0]?.explanation).toContain(
      "did not return a valid AnalysisResult",
    );
  });

  it("reports a failure for a requested rule id that is not registered in the catalog", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({
      subject,
      ruleIds: ["fake.does-not-exist"],
    });

    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.results[0]?.ruleId).toBe("fake.does-not-exist");
    expect(run.results[0]?.explanation).toContain(
      'No rule is registered for id "fake.does-not-exist"',
    );
  });

  it("attributes an engine-synthesized failure to the engine, not the rule", async () => {
    const catalog = new InMemoryRuleCatalog([throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.results[0]?.analyzer).toEqual({
      name: "principled-rule-engine",
      version: "1",
    });
    expect(run.results[0]?.limitations).toEqual([
      "Synthesized by the engine after the rule failed to run; not the rule's own judgment.",
    ]);
    expect(run.results[0]?.evidence).toEqual([]);
  });

  it("returns an empty run for an empty catalog and no selection", async () => {
    const engine = new AnalyzeSubject(new InMemoryRuleCatalog());

    const run = await engine.execute({ subject });

    expect(run.results).toEqual([]);
    expect(run.events.map((event) => event.eventType)).toEqual([
      "AnalysisRequested",
    ]);
  });

  it("generates a real analysisId when no id generator is injected", async () => {
    const engine = new AnalyzeSubject(new InMemoryRuleCatalog([alwaysCompliant]));

    const run = await engine.execute({ subject });

    expect(typeof run.analysisId).toBe("string");
    expect(run.analysisId.length).toBeGreaterThan(0);
    expect(run.analysisId).not.toBe(run.events[0]?.eventId);
  });

  it("uses the injected id generator for the analysisId and every event id", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant]);
    const engine = new AnalyzeSubject(catalog, {
      generateId: idSequence("gen"),
    });

    const run = await engine.execute({ subject });

    expect(run.analysisId).toBe("gen-1");
    expect(run.events[0]?.eventId).toBe("gen-2");
    expect(run.events[1]?.eventId).toBe("gen-3");
  });

  it("correlates every event in a run under the same correlationId", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant, throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    for (const event of run.events) {
      expect(event.correlationId).toBe(run.analysisId);
    }
  });

  it("ties each completion/failure event's causationId to the request event that caused it", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant, throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });
    const [requested, ...rest] = run.events;

    for (const event of rest) {
      expect(event.causationId).toBe(requested!.eventId);
    }
  });

  it("records the language and selected rule ids on the requested event", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysCompliant]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.events[0]).toMatchObject({
      eventType: "AnalysisRequested",
      eventVersion: 1,
      payload: { language: "typescript", ruleIds: ["fake.always-compliant"] },
    });
  });

  it("records status, method and confidence on a completed event", async () => {
    const catalog = new InMemoryRuleCatalog([alwaysViolation]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.events[1]).toMatchObject({
      eventType: "AnalysisCompleted",
      payload: {
        ruleId: "fake.always-violation",
        language: "typescript",
        status: "violation",
        method: "deterministic",
        confidence: 1,
      },
    });
  });

  it("records the reason on a failed event", async () => {
    const catalog = new InMemoryRuleCatalog([throwsSynchronously]);
    const engine = new AnalyzeSubject(catalog);

    const run = await engine.execute({ subject });

    expect(run.events[1]).toMatchObject({
      eventType: "AnalysisFailed",
      payload: {
        ruleId: "fake.throws",
        language: "typescript",
        reason: "boom",
      },
    });
  });

  it("reports a non-Error thrown value as its string form", async () => {
    const throwsString: Rule = {
      id: "fake.throws-string",
      evaluate: () => {
        throw "not an Error instance";
      },
    };
    const engine = new AnalyzeSubject(new InMemoryRuleCatalog([throwsString]));

    const run = await engine.execute({ subject });

    expect(run.results[0]?.explanation).toContain("not an Error instance");
  });

  it("calls no instrumentation hooks by default and does not throw", async () => {
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([alwaysCompliant, throwsSynchronously]),
    );

    await expect(engine.execute({ subject })).resolves.toBeDefined();
  });

  it("reports rule latency, throughput and analysis latency through injected instrumentation", async () => {
    const ruleLatencies: Array<{ ruleId: string; durationMs: number }> = [];
    let analysisLatencyMs: number | undefined;
    let throughput: number | undefined;

    const instrumentation: EngineInstrumentation = {
      recordRuleLatency: (ruleId, durationMs) => {
        ruleLatencies.push({ ruleId, durationMs });
      },
      recordAnalysisLatency: (durationMs) => {
        analysisLatencyMs = durationMs;
      },
      recordThroughput: (ruleCount) => {
        throughput = ruleCount;
      },
    };

    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([alwaysCompliant, alwaysViolation]),
      { instrumentation },
    );

    await engine.execute({ subject });

    expect(ruleLatencies.map((entry) => entry.ruleId)).toEqual([
      "fake.always-compliant",
      "fake.always-violation",
    ]);
    expect(
      ruleLatencies.every(
        (entry) => entry.durationMs >= 0 && entry.durationMs < 1000,
      ),
    ).toBe(true);
    expect(analysisLatencyMs).toBeGreaterThanOrEqual(0);
    expect(analysisLatencyMs).toBeLessThan(1000);
    expect(throughput).toBe(2);
  });

  it("reports a failing rule's latency as a small elapsed duration, not a timestamp sum", async () => {
    const latencies: number[] = [];
    const instrumentation: EngineInstrumentation = {
      recordRuleLatency: (_ruleId, durationMs) => {
        latencies.push(durationMs);
      },
    };
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([throwsSynchronously]),
      { instrumentation },
    );

    await engine.execute({ subject });

    expect(latencies).toHaveLength(1);
    expect(latencies[0]).toBeGreaterThanOrEqual(0);
    expect(latencies[0]).toBeLessThan(1000);
  });

  it("reports result-contract validity as true for a genuine result and false for a failure", async () => {
    const validity: Array<{ ruleId: string; valid: boolean }> = [];
    const instrumentation: EngineInstrumentation = {
      recordResultContractValidity: (ruleId, valid) => {
        validity.push({ ruleId, valid });
      },
    };
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([alwaysCompliant, violatesContract]),
      { instrumentation },
    );

    await engine.execute({ subject });

    expect(validity).toEqual([
      { ruleId: "fake.always-compliant", valid: true },
      { ruleId: "fake.violates-contract", valid: false },
    ]);
  });

  it("reports a rule failure exactly once per failing rule, with its reason", async () => {
    const failures: Array<{ ruleId: string; reason: string }> = [];
    const instrumentation: EngineInstrumentation = {
      recordRuleFailure: (ruleId, reason) => {
        failures.push({ ruleId, reason });
      },
    };
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([alwaysCompliant, throwsSynchronously]),
      { instrumentation },
    );

    await engine.execute({ subject });

    expect(failures).toEqual([{ ruleId: "fake.throws", reason: "boom" }]);
  });
});
