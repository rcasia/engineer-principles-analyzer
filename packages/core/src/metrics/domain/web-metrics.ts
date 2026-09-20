import { assertTelemetrySafe } from "../../compliance/domain/sensitive-data.ts";

/**
 * Privacy-safe web product metrics (#31).
 *
 * The hosted web product needs operational signals — requests, failures,
 * latency, aggregate language and rule-selection distributions — without
 * becoming a tracking system. This module is the executable form of that
 * boundary:
 *
 * - The input events carry only identifiers and facts: a bare request marker,
 *   and settled outcomes with language, executed rule ids and duration. There
 *   is no field for source code, prompts, findings, repository names or user
 *   identifiers, so retaining any of them is a compile-time change, not a
 *   silent one.
 * - Every recorded event is additionally scanned with #28's
 *   `assertTelemetrySafe`, so a future field that smuggles sensitive data
 *   fails fast at record time instead of entering the aggregates.
 * - Measurement is server-side and first-party: no cookies, no third-party
 *   analytics, no persistent identifiers.
 * - The CLI never touches this module; it stays telemetry-free by default
 *   (#18, #28).
 *
 * Pure domain module: no I/O, no clock reads. Durations arrive inside the
 * events so the fold stays deterministic and testable.
 */

export type WebMetricEvent =
  | {
      readonly kind: "analysis-requested";
    }
  | {
      readonly kind: "analysis-completed";
      readonly language: string;
      readonly ruleIds: readonly string[];
      readonly durationMs: number;
    }
  | {
      readonly kind: "analysis-failed";
      readonly language: string;
      readonly ruleIds: readonly string[];
      readonly durationMs: number;
    };

export interface WebMetricsSummary {
  /** Submissions received, including ones that never settled. */
  readonly totalRequests: number;
  /** Analyses where every requested rule settled with a completion. */
  readonly completedAnalyses: number;
  /** Analyses where at least one rule failed or the request was rejected. */
  readonly failedAnalyses: number;
  /** `failedAnalyses / settled`, or `0` before anything has settled. */
  readonly failureRate: number;
  /** Submissions received but never settled — abandonment without tracking. */
  readonly abandonedRequests: number;
  /** Median settled-analysis latency in ms, or `null` with no settlements. */
  readonly latencyP50Ms: number | null;
  /** 95th-percentile settled-analysis latency in ms, or `null` when empty. */
  readonly latencyP95Ms: number | null;
  /** Requested analyses per language, aggregated. */
  readonly languageDistribution: Readonly<Record<string, number>>;
  /** Requested analyses per selected rule, aggregated. */
  readonly ruleSelectionDistribution: Readonly<Record<string, number>>;
}

export const INITIAL_WEB_METRICS_SUMMARY: WebMetricsSummary = {
  totalRequests: 0,
  completedAnalyses: 0,
  failedAnalyses: 0,
  failureRate: 0,
  abandonedRequests: 0,
  latencyP50Ms: null,
  latencyP95Ms: null,
  languageDistribution: {},
  ruleSelectionDistribution: {},
};

function percentile(sorted: readonly number[], rank: number): number | null {
  const head = sorted.slice(0, Math.ceil(rank * sorted.length));
  let selected: number | null = null;

  for (const value of head) {
    selected = value;
  }

  return selected;
}

/**
 * Immutable fold over {@link WebMetricEvent}: each `record` returns the
 * accumulation including the new event, so the metrics projection can be
 * rebuilt from the event stream and never becomes a second mutable state
 * (#33). Summaries are disposable read models derived via {@link summarize}.
 */
export class WebMetrics {
  private constructor(
    private readonly requests: number,
    private readonly completed: number,
    private readonly failed: number,
    private readonly latenciesMs: readonly number[],
    private readonly languages: Readonly<Record<string, number>>,
    private readonly rules: Readonly<Record<string, number>>,
  ) {}

  static empty(): WebMetrics {
    return new WebMetrics(0, 0, 0, [], {}, {});
  }

  record(event: WebMetricEvent): WebMetrics {
    assertTelemetrySafe(event);

    if (event.kind === "analysis-requested") {
      return new WebMetrics(
        this.requests + 1,
        this.completed,
        this.failed,
        this.latenciesMs,
        this.languages,
        this.rules,
      );
    }

    const languages = {
      ...this.languages,
      [event.language]: (this.languages[event.language] ?? 0) + 1,
    };
    const rules = { ...this.rules };

    for (const ruleId of event.ruleIds) {
      rules[ruleId] = (rules[ruleId] ?? 0) + 1;
    }

    return new WebMetrics(
      this.requests,
      this.completed + (event.kind === "analysis-completed" ? 1 : 0),
      this.failed + (event.kind === "analysis-failed" ? 1 : 0),
      [...this.latenciesMs, event.durationMs],
      languages,
      rules,
    );
  }

  summarize(): WebMetricsSummary {
    const settled = this.completed + this.failed;
    const sorted = [...this.latenciesMs].sort((a, b) => a - b);

    return {
      totalRequests: this.requests,
      completedAnalyses: this.completed,
      failedAnalyses: this.failed,
      failureRate: settled === 0 ? 0 : this.failed / settled,
      abandonedRequests: this.requests - settled,
      latencyP50Ms: percentile(sorted, 0.5),
      latencyP95Ms: percentile(sorted, 0.95),
      languageDistribution: { ...this.languages },
      ruleSelectionDistribution: { ...this.rules },
    };
  }
}
