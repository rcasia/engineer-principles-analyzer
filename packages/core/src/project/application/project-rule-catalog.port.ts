import type { ProjectRule } from "./project-rule.port.ts";

/**
 * Driven port: the project use-case asks for project rules, it does not
 * care whether they come from memory, a plugin directory (#24), or a remote
 * registry. Mirrors the engine's `RuleCatalog` on purpose.
 */
export interface ProjectRuleCatalog {
  all(): Promise<readonly ProjectRule[]>;
}
