import { describe, expect, it } from "bun:test";
import { TelemetryContainsSensitiveDataError } from "../../compliance/domain/sensitive-data.ts";
import {
  INITIAL_WEB_METRICS_SUMMARY,
  WebMetrics,
  type WebMetricEvent,
} from "./web-metrics.ts";

const REQUESTED: WebMetricEvent = { kind: "analysis-requested" };

function completed(
  durationMs: number,
  language = "typescript",
  ruleIds: readonly string[] = ["srp"],
): WebMetricEvent {
  return { kind: "analysis-completed", language, ruleIds, durationMs };
}

function failed(
  durationMs: number,
  language = "typescript",
  ruleIds: readonly string[] = ["srp"],
): WebMetricEvent {
  return { kind: "analysis-failed", language, ruleIds, durationMs };
}

describe("WebMetrics", () => {
  it("starts empty with no data to report", () => {
    expect(WebMetrics.empty().summarize()).toEqual(
      INITIAL_WEB_METRICS_SUMMARY,
    );
    expect(INITIAL_WEB_METRICS_SUMMARY).toEqual({
      totalRequests: 0,
      completedAnalyses: 0,
      failedAnalyses: 0,
      failureRate: 0,
      abandonedRequests: 0,
      latencyP50Ms: null,
      latencyP95Ms: null,
      languageDistribution: {},
      ruleSelectionDistribution: {},
    });
  });

  it("counts a request that never settles as abandoned, not failed", () => {
    const summary = WebMetrics.empty().record(REQUESTED).summarize();

    expect(summary.totalRequests).toBe(1);
    expect(summary.completedAnalyses).toBe(0);
    expect(summary.failedAnalyses).toBe(0);
    expect(summary.failureRate).toBe(0);
    expect(summary.abandonedRequests).toBe(1);
    expect(summary.latencyP50Ms).toBeNull();
    expect(summary.latencyP95Ms).toBeNull();
    expect(summary.languageDistribution).toEqual({});
    expect(summary.ruleSelectionDistribution).toEqual({});
  });

  it("settles a completed analysis with its latency", () => {
    const summary = WebMetrics.empty()
      .record(REQUESTED)
      .record(completed(120))
      .summarize();

    expect(summary.totalRequests).toBe(1);
    expect(summary.completedAnalyses).toBe(1);
    expect(summary.failedAnalyses).toBe(0);
    expect(summary.failureRate).toBe(0);
    expect(summary.abandonedRequests).toBe(0);
    expect(summary.latencyP50Ms).toBe(120);
    expect(summary.latencyP95Ms).toBe(120);
  });

  it("reports the failure rate over settled analyses only", () => {
    const summary = WebMetrics.empty()
      .record(REQUESTED)
      .record(completed(100))
      .record(REQUESTED)
      .record(failed(200))
      .record(REQUESTED)
      .summarize();

    expect(summary.totalRequests).toBe(3);
    expect(summary.completedAnalyses).toBe(1);
    expect(summary.failedAnalyses).toBe(1);
    expect(summary.failureRate).toBe(0.5);
    expect(summary.abandonedRequests).toBe(1);
  });

  it("computes p50 and p95 over settled latencies", () => {
    const metrics = [10, 20, 30, 40].reduce(
      (acc, ms) => acc.record(REQUESTED).record(completed(ms)),
      WebMetrics.empty(),
    );

    const summary = metrics.summarize();

    expect(summary.latencyP50Ms).toBe(20);
    expect(summary.latencyP95Ms).toBe(40);
  });

  it("aggregates settled language and rule-selection distributions", () => {
    const summary = WebMetrics.empty()
      .record(REQUESTED)
      .record(completed(10, "typescript", ["srp"]))
      .record(REQUESTED)
      .record(failed(30, "python", ["srp", "ocp"]))
      .summarize();

    expect(summary.languageDistribution).toEqual({
      typescript: 1,
      python: 1,
    });
    expect(summary.ruleSelectionDistribution).toEqual({ srp: 2, ocp: 1 });
  });

  it("never mutates the accumulation it derived from", () => {
    const empty = WebMetrics.empty();
    const recorded = empty.record(REQUESTED);

    expect(empty.summarize()).toEqual(INITIAL_WEB_METRICS_SUMMARY);
    expect(recorded.summarize().totalRequests).toBe(1);
  });

  it("hands out a fresh distribution copy on every summary", () => {
    const metrics = WebMetrics.empty()
      .record(REQUESTED)
      .record(completed(10));

    expect(metrics.summarize().languageDistribution).not.toBe(
      metrics.summarize().languageDistribution,
    );
  });

  it("refuses an event carrying source code", () => {
    const smuggled = {
      kind: "analysis-completed",
      language: "typescript",
      ruleIds: ["srp"],
      durationMs: 5,
      sourceCode: "const a = 1;",
    } as unknown as WebMetricEvent;

    try {
      WebMetrics.empty().record(smuggled);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TelemetryContainsSensitiveDataError);
      expect((error as Error).message).toBe(
        "Telemetry payload contains forbidden keys: sourceCode.",
      );
    }
  });

  it("refuses an event carrying findings", () => {
    const smuggled = {
      kind: "analysis-requested",
      findings: [{ ruleId: "srp" }],
    } as unknown as WebMetricEvent;

    expect(() => WebMetrics.empty().record(smuggled)).toThrow(
      new TelemetryContainsSensitiveDataError(["findings"]),
    );
  });
});
