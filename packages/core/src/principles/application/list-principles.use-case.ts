import type { Principle } from "../domain/principle.ts";
import type { PrincipleCatalog } from "./principle-catalog.port.ts";

/**
 * Driving side of the hexagon: the single entry point adapters (cli, web)
 * use to list the known principles.
 */
export class ListPrinciples {
  constructor(private readonly catalog: PrincipleCatalog) {}

  async execute(): Promise<readonly Principle[]> {
    return await this.catalog.all();
  }
}
