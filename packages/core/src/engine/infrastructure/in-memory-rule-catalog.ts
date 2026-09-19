import type { Rule } from "../application/rule.port.ts";
import type { RuleCatalog } from "../application/rule-catalog.port.ts";

/**
 * Driven adapter backed by memory. Seeded by the caller on purpose, exactly
 * like `InMemoryPrincipleCatalog`: this package ships no rules of its own —
 * the SOLID rules are their own issues (#10-#14) and register themselves
 * here once they exist.
 */
export class InMemoryRuleCatalog implements RuleCatalog {
  private readonly rules: readonly Rule[];

  constructor(rules: readonly Rule[] = []) {
    this.rules = [...rules];
  }

  async all(): Promise<readonly Rule[]> {
    return [...this.rules];
  }
}
