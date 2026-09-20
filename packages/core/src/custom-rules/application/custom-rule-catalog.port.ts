import type { CustomRuleDefinition } from "../domain/custom-rule.ts";
import type { VersionedRule } from "./versioned-rule.port.ts";

/**
 * Driven port: where versioned custom rules and their definitions come
 * from — memory, a plugin directory, or a registry. The engine's
 * `RuleCatalog` deliberately stays untouched: version pinning and
 * provenance are custom-rule concerns, not engine concerns.
 */
export interface CustomRuleCatalog {
  /** Every executable rule available. */
  rules(): Promise<readonly VersionedRule[]>;
  /** The definition for one exact id and version pin, if it exists. */
  definition(ruleId: string, version: string): Promise<CustomRuleDefinition | undefined>;
}
