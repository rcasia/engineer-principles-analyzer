import type { Principle } from "../domain/principle.ts";
import type { PrincipleCatalog } from "../application/principle-catalog.port.ts";

/**
 * Driven adapter backed by memory. Seeded by the caller on purpose: the real
 * catalog of principles is not decided yet, so this package ships none.
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
