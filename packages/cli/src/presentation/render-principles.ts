import type { Principle } from "@principled/core";

export const NO_PRINCIPLES_MESSAGE = "No principles are defined yet.";

/**
 * Pure presentation: principles in, text out. Keeping this free of I/O is what
 * makes the CLI's output assertable without spawning a process.
 */
export function renderPrinciples(principles: readonly Principle[]): string {
  if (principles.length === 0) {
    return NO_PRINCIPLES_MESSAGE;
  }

  return principles
    .map((principle) => `- ${principle.id}: ${principle.title}`)
    .join("\n");
}
