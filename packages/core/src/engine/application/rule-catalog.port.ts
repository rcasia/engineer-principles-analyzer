import type { Rule } from "./rule.port.ts";

/**
 * Driven port: the engine asks for rules, it does not care whether they come
 * from memory, a plugin directory (#24), or a remote registry.
 *
 * Mirrors `PrincipleCatalog` deliberately: a rule is what actually decides a
 * principle, so the two ports are shaped the same way on purpose.
 */
export interface RuleCatalog {
  all(): Promise<readonly Rule[]>;
}
