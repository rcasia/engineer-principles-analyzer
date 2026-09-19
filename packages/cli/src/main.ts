import { InMemoryPrincipleCatalog, ListPrinciples } from "@epa/core";
import { renderPrinciples } from "./presentation/render-principles.ts";

export type Writer = (line: string) => void;

/**
 * Composition root. The hexagon is assembled here and nowhere else, and the
 * output port is injected so the whole command is testable in-process.
 */
export async function main(write: Writer): Promise<void> {
  const listPrinciples = new ListPrinciples(new InMemoryPrincipleCatalog());

  write(renderPrinciples(await listPrinciples.execute()));
}
