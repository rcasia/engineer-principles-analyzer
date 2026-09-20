import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidRuleVersionError extends Error {
  override readonly name = "InvalidRuleVersionError";
}

/**
 * A custom rule's version (#40 "a rule has a stable identity and version"):
 * numeric `MAJOR[.MINOR[.PATCH]]`. Updating a rule creates a new version;
 * historical events keep the old one, so past findings never silently
 * change meaning (#24 "Event sourcing").
 *
 * Versions compare by exact string equality — `"1.0"` and `"1.0.0"` are
 * different pins — so a ruleset always resolves to precisely the rule it
 * names.
 */
export class RuleVersion {
  private constructor(readonly value: string) {}

  static of(value: string): Result<RuleVersion, InvalidRuleVersionError> {
    if (/^\d+(\.\d+){0,2}$/.test(value)) {
      return ok(new RuleVersion(value));
    }
    return err(
      new InvalidRuleVersionError(
        `rule version must be numeric MAJOR[.MINOR[.PATCH]], got "${value}".`,
      ),
    );
  }

  toString(): string {
    return this.value;
  }
}
