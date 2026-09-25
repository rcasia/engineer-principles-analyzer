import type { Principle } from "../domain/principle.ts";
import type { PrincipleCatalog } from "../application/principle-catalog.port.ts";

/**
 * Driven adapter backed by memory. Seeded by the caller: production
 * composition roots seed it with `SOLID_PRINCIPLES`, tests seed what they
 * need (including nothing for the empty state).
 */
export class InMemoryPrincipleCatalog implements PrincipleCatalog {
  private readonly principles: readonly Principle[];

  constructor(principles: readonly Principle[] = []) {
    this.principles = [...principles];
  }

  async all(): Promise<readonly Principle[]> {
    return [...this.principles];
  }
}
