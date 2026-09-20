import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { InvalidRulesetError, Ruleset } from "./ruleset.ts";

function props() {
  return {
    id: "acme.backend",
    version: "2.0.0",
    rules: [
      { ruleId: "acme.no-console", version: "1.2.0" },
      { ruleId: "acme.no-todo", version: "0.3.0" },
    ],
  };
}

describe("Ruleset", () => {
  it("constructs with the exact entries it was given", () => {
    const ruleset = unwrap(Ruleset.of(props()));

    expect(ruleset.id).toBe("acme.backend");
    expect(ruleset.version.toString()).toBe("2.0.0");
    expect(ruleset.size).toBe(2);
    expect(ruleset.ruleIds()).toEqual(["acme.no-console", "acme.no-todo"]);
    expect(ruleset.versionFor("acme.no-console")?.toString()).toBe("1.2.0");
    expect(ruleset.versionFor("acme.unknown")).toBeUndefined();
  });

  it("rejects an empty id", () => {
    expect(unwrapErr(Ruleset.of({ ...props(), id: " " }))).toEqual(
      new InvalidRulesetError("ruleset id must not be empty."),
    );
  });

  it("rejects a malformed ruleset version", () => {
    expect(unwrapErr(Ruleset.of({ ...props(), version: "v2" }))).toEqual(
      new InvalidRulesetError(
        'rule version must be numeric MAJOR[.MINOR[.PATCH]], got "v2".',
      ),
    );
  });

  it("rejects an empty ruleset", () => {
    expect(unwrapErr(Ruleset.of({ ...props(), rules: [] }))).toEqual(
      new InvalidRulesetError("ruleset must reference at least one rule."),
    );
  });

  it("rejects empty rule references", () => {
    expect(
      unwrapErr(
        Ruleset.of({
          ...props(),
          rules: [{ ruleId: "", version: "1.0.0" }],
        }),
      ),
    ).toEqual(
      new InvalidRulesetError("ruleset rule ids must not be empty."),
    );
  });

  it("rejects malformed rule pins", () => {
    expect(
      unwrapErr(
        Ruleset.of({
          ...props(),
          rules: [{ ruleId: "acme.x", version: "latest" }],
        }),
      ),
    ).toEqual(
      new InvalidRulesetError(
        'rule version must be numeric MAJOR[.MINOR[.PATCH]], got "latest".',
      ),
    );
  });

  it("rejects duplicate rule references", () => {
    expect(
      unwrapErr(
        Ruleset.of({
          ...props(),
          rules: [
            { ruleId: "acme.x", version: "1.0.0" },
            { ruleId: "acme.x", version: "2.0.0" },
          ],
        }),
      ),
    ).toEqual(
      new InvalidRulesetError('duplicate rule reference "acme.x".'),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidRulesetError("boom").name).toBe("InvalidRulesetError");
  });
});
