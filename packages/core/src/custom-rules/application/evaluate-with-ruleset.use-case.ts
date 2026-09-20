import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { AnalyzerMetadata } from "../../analysis/domain/analyzer-metadata.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import type { IdGenerator } from "../../engine/application/analyze-subject.use-case.ts";
import type { Subject } from "../../engine/domain/subject.ts";
import type { NewEvent } from "../../eventsourcing/application/event-store.port.ts";
import { unwrap } from "../../shared/result.ts";
import {
  CUSTOM_RULE_COMPLETED_EVENT,
  CUSTOM_RULE_FAILED_EVENT,
  type CustomRuleEventPayload,
} from "../domain/custom-rule-event.ts";
import type { Ruleset } from "../domain/ruleset.ts";
import type { CustomRuleCatalog } from "./custom-rule-catalog.port.ts";
import type { VersionedRule } from "./versioned-rule.port.ts";

/** Identifies results the ruleset use-case synthesized itself, not any rule's own verdict. */
const RULESET_ENGINE_ANALYZER: AnalyzerMetadata = {
  name: "principled-ruleset-engine",
  version: "1",
};

const randomId: IdGenerator = () => crypto.randomUUID();

export interface RulesetEvaluationRequest {
  readonly subject: Subject;
  /** The ruleset to evaluate. Every entry pins the exact version to run. */
  readonly ruleset: Ruleset;
  /** Restrict the run to these rule ids. Omitted: every rule the ruleset references runs. */
  readonly ruleIds?: readonly string[];
}

export interface RulesetEvaluation {
  /** One result per evaluated rule, in ruleset declaration order. */
  readonly results: readonly AnalysisResult[];
  /** One completion or failure per evaluated rule, each retaining rule and ruleset versions. */
  readonly events: readonly NewEvent<CustomRuleEventPayload>[];
}

/**
 * Evaluates a versioned ruleset against one subject (#24, #40): resolves
 * each referenced rule at its pinned version, runs it in isolation, and
 * emits version-retaining events instead of persisting anything.
 *
 * A version mismatch is a failure, not a fallback: running an unpinned
 * version would make the finding unreproducible, so a missing pin produces
 * an `unable_to_analyze` result and a `CustomRuleFailed` event naming the
 * expected version.
 */
export class EvaluateWithRuleset {
  private readonly catalog: CustomRuleCatalog;
  private readonly generateId: IdGenerator;

  constructor(
    catalog: CustomRuleCatalog,
    options?: { readonly generateId?: IdGenerator },
  ) {
    this.catalog = catalog;
    this.generateId = options?.generateId ?? randomId;
  }

  async execute(request: RulesetEvaluationRequest): Promise<RulesetEvaluation> {
    const rules = await this.catalog.rules();
    const refs = request.ruleset.rules.filter(
      (ref) => request.ruleIds === undefined || request.ruleIds.includes(ref.ruleId),
    );

    const results: AnalysisResult[] = [];
    const events: NewEvent<CustomRuleEventPayload>[] = [];
    for (const ref of refs) {
      const rule = rules.find(
        (candidate) =>
          candidate.id === ref.ruleId &&
          candidate.version === ref.version.toString(),
      );
      const outcome = await this.run(rule, ref.ruleId, ref.version.toString(), request);
      results.push(outcome.result);
      events.push(outcome.event);
    }

    return { results, events };
  }

  private async run(
    rule: VersionedRule | undefined,
    ruleId: string,
    ruleVersion: string,
    request: RulesetEvaluationRequest,
  ): Promise<{ readonly result: AnalysisResult; readonly event: NewEvent<CustomRuleEventPayload> }> {
    const rulesetVersion = request.ruleset.version.toString();
    const failed = (
      reason: string,
    ): { readonly result: AnalysisResult; readonly event: NewEvent<CustomRuleEventPayload> } => ({
      result: unwrap(
        AnalysisResult.of({
          ruleId,
          status: "unable_to_analyze",
          confidence: unwrap(Confidence.of(0)),
          method: "heuristic",
          evidence: [],
          explanation: `The ruleset engine could not obtain a verdict from this rule: ${reason}`,
          language: request.subject.language,
          analyzer: RULESET_ENGINE_ANALYZER,
          limitations: [
            "Synthesized by the ruleset engine after the rule failed to run; not the rule's own judgment.",
          ],
          humanReviewRecommended: true,
        }),
      ),
      event: {
        eventId: this.generateId(),
        eventType: CUSTOM_RULE_FAILED_EVENT,
        eventVersion: 1,
        correlationId: request.ruleset.id,
        causationId: request.ruleset.id,
        payload: {
          ruleId,
          ruleVersion,
          rulesetId: request.ruleset.id,
          rulesetVersion,
          reason,
        },
      },
    });

    if (rule === undefined) {
      return failed(
        `No rule "${ruleId}" at version "${ruleVersion}" is registered.`,
      );
    }

    try {
      const outcome = await rule.evaluate(request.subject);
      if (!(outcome instanceof AnalysisResult)) {
        return failed(
          `Rule "${ruleId}" did not return a valid AnalysisResult.`,
        );
      }
      return {
        result: outcome,
        event: {
          eventId: this.generateId(),
          eventType: CUSTOM_RULE_COMPLETED_EVENT,
          eventVersion: 1,
          correlationId: request.ruleset.id,
          causationId: request.ruleset.id,
          payload: {
            ruleId,
            ruleVersion,
            rulesetId: request.ruleset.id,
            rulesetVersion,
            status: outcome.status,
            method: outcome.method,
            confidence: outcome.confidence.value,
          },
        },
      };
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
  }
}
