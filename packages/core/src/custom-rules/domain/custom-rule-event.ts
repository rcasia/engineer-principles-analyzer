/**
 * The facts a ruleset evaluation can hold in its event stream (#24 "Event
 * sourcing", #40 "historical analysis can identify which rule/ruleset
 * version produced a finding"): one completion or failure per evaluated
 * rule, each retaining the exact rule and ruleset versions that produced
 * the decision.
 *
 * No payload carries `sourceCode` or any excerpt of it — only identifiers,
 * versions and the already-minimized facts `AnalysisResult` itself
 * exposes — so replaying history never resurrects customer source.
 */
export const CUSTOM_RULE_COMPLETED_EVENT = "CustomRuleCompleted";
export const CUSTOM_RULE_FAILED_EVENT = "CustomRuleFailed";

export interface CustomRuleCompletedPayload {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly status: string;
  readonly method: string;
  readonly confidence: number;
}

export interface CustomRuleFailedPayload {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly reason: string;
}

export type CustomRuleEventPayload =
  | CustomRuleCompletedPayload
  | CustomRuleFailedPayload;
