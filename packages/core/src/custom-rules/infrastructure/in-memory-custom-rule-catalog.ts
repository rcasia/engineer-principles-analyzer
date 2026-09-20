import { unwrap } from "../../shared/result.ts";
import { CustomRuleDefinition } from "../domain/custom-rule.ts";
import type {
  CustomRuleCatalog,
} from "../application/custom-rule-catalog.port.ts";
import type { VersionedRule } from "../application/versioned-rule.port.ts";

export interface CustomRuleEntry {
  readonly definition: CustomRuleDefinition;
  readonly rule: VersionedRule;
}

/**
 * Driven adapter backed by memory. Seeded by the caller with
 * definition/rule pairs: the definition carries identity, provenance and
 * lifecycle status; the rule carries the executable judgment. A real
 * registry adapter (plugin directory, remote rules) implements the same
 * port.
 */
export class InMemoryCustomRuleCatalog implements CustomRuleCatalog {
  private readonly entries: readonly CustomRuleEntry[];

  constructor(entries: readonly CustomRuleEntry[] = []) {
    this.entries = [...entries];
  }

  async rules(): Promise<readonly VersionedRule[]> {
    return this.entries.map((entry) => entry.rule);
  }

  async definition(
    ruleId: string,
    version: string,
  ): Promise<CustomRuleDefinition | undefined> {
    return this.entries.find(
      (entry) =>
        entry.definition.id === ruleId &&
        entry.definition.version.toString() === version,
    )?.definition;
  }
}

export function customRuleEntry(
  props: {
    readonly id: string;
    readonly version: string;
    readonly author: string;
    readonly status: "draft" | "active" | "deprecated";
    readonly evaluate: VersionedRule["evaluate"];
  },
): CustomRuleEntry {
  const definition = unwrap(
    CustomRuleDefinition.of({
      id: props.id,
      version: props.version,
      author: props.author,
      status: props.status,
    }),
  );
  return {
    definition,
    rule: {
      id: props.id,
      version: props.version,
      author: props.author,
      evaluate: props.evaluate,
    },
  };
}
