import { err, ok, type Result } from "../../shared/result.ts";
import { RuleVersion } from "./rule-version.ts";

export class InvalidRulesetError extends Error {
  override readonly name = "InvalidRulesetError";
}

export interface RulesetRuleRef {
  readonly ruleId: string;
  /** Exact version pin the ruleset evaluates. */
  readonly version: string;
}

export interface RulesetProps {
  /** Stable identity, e.g. `"acme.backend"`. */
  readonly id: string;
  readonly version: string;
  readonly rules: readonly RulesetRuleRef[];
}

/**
 * A composable, selectable set of versioned custom rules (#40 "rulesets
 * can be composed and selected for an analysis").
 *
 * Immutable value object: the only way to obtain one is {@link Ruleset.of}.
 * Every entry pins an exact version — a ruleset never floats — so re-running
 * the same ruleset version reproduces the same decisions, and historical
 * events name precisely what ran.
 */
export class Ruleset {
  private constructor(
    readonly id: string,
    readonly version: RuleVersion,
    readonly rules: readonly { readonly ruleId: string; readonly version: RuleVersion }[],
  ) {}

  static of(props: RulesetProps): Result<Ruleset, InvalidRulesetError> {
    if (props.id.trim().length === 0) {
      return err(new InvalidRulesetError("ruleset id must not be empty."));
    }

    const version = RuleVersion.of(props.version);
    if (!version.ok) {
      return err(new InvalidRulesetError(version.error.message));
    }

    if (props.rules.length === 0) {
      return err(
        new InvalidRulesetError("ruleset must reference at least one rule."),
      );
    }

    const seen = new Set<string>();
    const rules: { readonly ruleId: string; readonly version: RuleVersion }[] = [];
    for (const ref of props.rules) {
      if (ref.ruleId.trim().length === 0) {
        return err(
          new InvalidRulesetError("ruleset rule ids must not be empty."),
        );
      }
      const refVersion = RuleVersion.of(ref.version);
      if (!refVersion.ok) {
        return err(new InvalidRulesetError(refVersion.error.message));
      }
      if (seen.has(ref.ruleId)) {
        return err(
          new InvalidRulesetError(
            `duplicate rule reference "${ref.ruleId}".`,
          ),
        );
      }
      seen.add(ref.ruleId);
      rules.push({ ruleId: ref.ruleId, version: refVersion.value });
    }

    return ok(new Ruleset(props.id, version.value, rules));
  }

  /** How many rules the set references. */
  get size(): number {
    return this.rules.length;
  }

  /** Every referenced rule id, in declaration order. */
  ruleIds(): readonly string[] {
    return this.rules.map((ref) => ref.ruleId);
  }

  /** The exact version pinned for a rule, or `undefined` when unreferenced. */
  versionFor(ruleId: string): RuleVersion | undefined {
    return this.rules.find((ref) => ref.ruleId === ruleId)?.version;
  }
}
