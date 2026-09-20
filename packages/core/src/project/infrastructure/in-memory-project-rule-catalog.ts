import type { ProjectRule } from "../application/project-rule.port.ts";
import type { ProjectRuleCatalog } from "../application/project-rule-catalog.port.ts";

/**
 * Driven adapter backed by memory. Ships empty and is seeded by the caller,
 * exactly like `InMemoryRuleCatalog`: this package owns no project rules of
 * its own — the architecture rules (#23) register themselves here once they
 * exist.
 */
export class InMemoryProjectRuleCatalog implements ProjectRuleCatalog {
  private readonly rules: readonly ProjectRule[];

  constructor(rules: readonly ProjectRule[] = []) {
    this.rules = [...rules];
  }

  async all(): Promise<readonly ProjectRule[]> {
    return [...this.rules];
  }
}
