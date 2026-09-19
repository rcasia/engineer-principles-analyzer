import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { AnalyzerMetadata } from "../../analysis/domain/analyzer-metadata.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import type { NewEvent } from "../../eventsourcing/application/event-store.port.ts";
import { unwrap } from "../../shared/result.ts";
import {
  ANALYSIS_COMPLETED_EVENT,
  ANALYSIS_FAILED_EVENT,
  ANALYSIS_REQUESTED_EVENT,
  type AnalysisEventPayload,
} from "../domain/analysis-event.ts";
import type { Subject } from "../domain/subject.ts";
import type { EngineInstrumentation } from "./instrumentation.port.ts";
import type { Rule } from "./rule.port.ts";
import type { RuleCatalog } from "./rule-catalog.port.ts";

/** Generates the identifiers used to correlate one run's events. Injectable so tests are deterministic. */
export type IdGenerator = () => string;

const randomId: IdGenerator = () => crypto.randomUUID();

/** Identifies results the engine synthesized itself, not any rule's own verdict. */
const ENGINE_ANALYZER: AnalyzerMetadata = {
  name: "principled-rule-engine",
  version: "1",
};

const NO_INSTRUMENTATION: EngineInstrumentation = {};

export interface AnalysisRequest {
  readonly subject: Subject;
  /** Restrict the run to these rule ids. Omitted: every rule in the catalog runs. */
  readonly ruleIds?: readonly string[];
}

export interface AnalysisRun {
  /** Suggested event-store stream id, if a caller chooses to append `events` (#9, #33). */
  readonly analysisId: string;
  /** One result per requested rule, in request order, whatever that rule did. */
  readonly results: readonly AnalysisResult[];
  /** Facts about the run, shaped for the event-sourcing ports (ADR-0012, #33). `AnalyzeSubject` never appends these itself — persistence stays explicit and outside core. */
  readonly events: readonly NewEvent<AnalysisEventPayload>[];
}

interface RuleOutcome {
  readonly result: AnalysisResult;
  readonly event: NewEvent<AnalysisEventPayload>;
}

/**
 * The rule evaluation engine (#9): runs independently-authored rules
 * against one {@link Subject} and composes their results into the contract
 * every adapter renders (#8).
 *
 * Three things make this the engine rather than a loop over `Rule.evaluate`:
 *
 * - **Fault isolation.** A rule that throws, rejects, or returns something
 *   that is not a genuine `AnalysisResult` cannot fail the run for every
 *   other rule; it becomes an `"unable_to_analyze"` result attributed to the
 *   engine, not the rule (ADR-0013).
 * - **A real distinction between a rule failure and an uncertain verdict.**
 *   A rule that runs to completion and honestly reports `"uncertain"` is a
 *   success as far as the engine is concerned — it produces an
 *   `AnalysisCompleted` event. A rule that never produced a verdict at all
 *   produces `AnalysisFailed` instead. See `domain/analysis-event.ts`.
 * - **No hidden I/O.** Rules are resolved from an injected `RuleCatalog`,
 *   telemetry only reaches an injected `EngineInstrumentation`, and the
 *   engine never appends the events it produces to an `EventStore` itself —
 *   a caller that wants persistence must ask for it explicitly.
 */
export class AnalyzeSubject {
  private readonly catalog: RuleCatalog;
  private readonly generateId: IdGenerator;
  private readonly instrumentation: EngineInstrumentation;

  constructor(
    catalog: RuleCatalog,
    options?: {
      readonly generateId?: IdGenerator;
      readonly instrumentation?: EngineInstrumentation;
    },
  ) {
    this.catalog = catalog;
    this.generateId = options?.generateId ?? randomId;
    this.instrumentation = options?.instrumentation ?? NO_INSTRUMENTATION;
  }

  async execute(request: AnalysisRequest): Promise<AnalysisRun> {
    const startedAt = Date.now();
    const analysisId = this.generateId();
    const rules = await this.catalog.all();
    const selected = selectRules(rules, request.ruleIds);

    const requested: NewEvent<AnalysisEventPayload> = {
      eventId: this.generateId(),
      eventType: ANALYSIS_REQUESTED_EVENT,
      eventVersion: 1,
      correlationId: analysisId,
      causationId: analysisId,
      payload: {
        language: request.subject.language,
        ruleIds: selected.map((entry) => entry.id),
      },
    };

    const outcomes = await Promise.all(
      selected.map((entry) =>
        this.run(entry, request.subject, analysisId, requested.eventId),
      ),
    );

    this.instrumentation.recordThroughput?.(selected.length);
    this.instrumentation.recordAnalysisLatency?.(Date.now() - startedAt);

    return {
      analysisId,
      results: outcomes.map((outcome) => outcome.result),
      events: [requested, ...outcomes.map((outcome) => outcome.event)],
    };
  }

  private async run(
    entry: SelectedRule,
    subject: Subject,
    analysisId: string,
    causationId: string,
  ): Promise<RuleOutcome> {
    const startedAt = Date.now();

    if (!entry.rule) {
      return this.fail(
        entry.id,
        subject,
        analysisId,
        causationId,
        `No rule is registered for id "${entry.id}".`,
        startedAt,
      );
    }

    try {
      const outcome = await entry.rule.evaluate(subject);

      if (!(outcome instanceof AnalysisResult)) {
        return this.fail(
          entry.id,
          subject,
          analysisId,
          causationId,
          `Rule "${entry.id}" did not return a valid AnalysisResult.`,
          startedAt,
        );
      }

      this.instrumentation.recordResultContractValidity?.(entry.id, true);
      this.instrumentation.recordRuleLatency?.(
        entry.id,
        Date.now() - startedAt,
      );

      const event: NewEvent<AnalysisEventPayload> = {
        eventId: this.generateId(),
        eventType: ANALYSIS_COMPLETED_EVENT,
        eventVersion: 1,
        correlationId: analysisId,
        causationId,
        payload: {
          ruleId: entry.id,
          language: subject.language,
          status: outcome.status,
          method: outcome.method,
          confidence: outcome.confidence.value,
        },
      };

      return { result: outcome, event };
    } catch (error) {
      return this.fail(
        entry.id,
        subject,
        analysisId,
        causationId,
        error instanceof Error ? error.message : String(error),
        startedAt,
      );
    }
  }

  private fail(
    ruleId: string,
    subject: Subject,
    analysisId: string,
    causationId: string,
    reason: string,
    startedAt: number,
  ): RuleOutcome {
    this.instrumentation.recordRuleLatency?.(
      ruleId,
      Date.now() - startedAt,
    );
    this.instrumentation.recordResultContractValidity?.(ruleId, false);
    this.instrumentation.recordRuleFailure?.(ruleId, reason);

    const result = unwrap(
      AnalysisResult.of({
        ruleId,
        status: "unable_to_analyze",
        confidence: unwrap(Confidence.of(0)),
        method: "heuristic",
        evidence: [],
        explanation: `The engine could not obtain a verdict from this rule: ${reason}`,
        language: subject.language,
        analyzer: ENGINE_ANALYZER,
        limitations: [
          "Synthesized by the engine after the rule failed to run; not the rule's own judgment.",
        ],
        humanReviewRecommended: true,
      }),
    );

    const event: NewEvent<AnalysisEventPayload> = {
      eventId: this.generateId(),
      eventType: ANALYSIS_FAILED_EVENT,
      eventVersion: 1,
      correlationId: analysisId,
      causationId,
      payload: { ruleId, language: subject.language, reason },
    };

    return { result, event };
  }
}

interface SelectedRule {
  readonly id: string;
  readonly rule: Rule | undefined;
}

function selectRules(
  rules: readonly Rule[],
  ruleIds: readonly string[] | undefined,
): readonly SelectedRule[] {
  if (!ruleIds) {
    return rules.map((rule) => ({ id: rule.id, rule }));
  }

  return ruleIds.map((id) => ({
    id,
    rule: rules.find((rule) => rule.id === id),
  }));
}
