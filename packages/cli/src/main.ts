import { InMemoryPrincipleCatalog, ListPrinciples } from "@epa/core";
import { renderPrinciples } from "./presentation/render-principles.ts";
import {
  renderUnknownOption,
  renderUsage,
  renderVersion,
} from "./presentation/usage.ts";

export type Writer = (line: string) => void;

export interface Console {
  readonly out: Writer;
  readonly err: Writer;
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 2;

const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h"]);
const VERSION_FLAGS: ReadonlySet<string> = new Set(["--version", "-v"]);

/**
 * Composition root. The hexagon is assembled here and nowhere else, and both
 * output streams are injected, so the whole command is testable in process
 * and the exit code is a return value rather than a side effect.
 */
export async function main(
  argv: readonly string[],
  console: Console,
): Promise<number> {
  const [option] = argv;

  if (option !== undefined) {
    if (HELP_FLAGS.has(option)) {
      console.out(renderUsage());
      return EXIT_OK;
    }

    if (VERSION_FLAGS.has(option)) {
      console.out(renderVersion());
      return EXIT_OK;
    }

    console.err(renderUnknownOption(option));
    return EXIT_USAGE;
  }

  const listPrinciples = new ListPrinciples(new InMemoryPrincipleCatalog());
  console.out(renderPrinciples(await listPrinciples.execute()));

  return EXIT_OK;
}
