import type { Principle } from "../domain/principle.ts";

/**
 * Driven port: the application asks for principles, it does not care whether
 * they come from memory, a file, or a remote service.
 */
export interface PrincipleCatalog {
  all(): Promise<readonly Principle[]>;
}
