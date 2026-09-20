import type { Rule } from "../../engine/application/rule.port.ts";

/**
 * Driven port: one versioned, independently executable custom rule
 * (#24, #40). Extends the engine's `Rule` with the identity facts the
 * evaluation events must retain to reproduce the decision: the exact
 * version that ran and who it came from.
 */
export interface VersionedRule extends Rule {
  /** Exact version that runs, e.g. `"1.2.0"`. Pinned by the ruleset. */
  readonly version: string;
  /** Author or source, e.g. a team name. */
  readonly author: string;
}
