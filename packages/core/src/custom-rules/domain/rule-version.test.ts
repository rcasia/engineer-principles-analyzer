import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { InvalidRuleVersionError, RuleVersion } from "./rule-version.ts";

describe("RuleVersion", () => {
  it.each(["1", "1.2", "1.2.3"])("accepts %p", (value) => {
    expect(unwrap(RuleVersion.of(value)).toString()).toBe(value);
  });

  it.each(["", "v1", "1.2.3.4", "1.x", "1.2-beta", " 1", "latest"])(
    "rejects %p",
    (value) => {
      expect(unwrapErr(RuleVersion.of(value))).toEqual(
        new InvalidRuleVersionError(
          `rule version must be numeric MAJOR[.MINOR[.PATCH]], got "${value}".`,
        ),
      );
    },
  );

  it("treats different-length pins as different versions", () => {
    expect(unwrap(RuleVersion.of("1.0")).toString()).not.toBe(
      unwrap(RuleVersion.of("1.0.0")).toString(),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidRuleVersionError("boom").name).toBe(
      "InvalidRuleVersionError",
    );
  });
});
