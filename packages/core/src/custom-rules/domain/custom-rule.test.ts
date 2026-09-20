import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  CustomRuleDefinition,
  InvalidCustomRuleError,
  isCustomRuleStatus,
  isPublicationAllowed,
} from "./custom-rule.ts";

function active() {
  return unwrap(
    CustomRuleDefinition.of({
      id: "acme.no-console",
      version: "1.2.0",
      author: "acme-team",
      status: "active",
    }),
  );
}

describe("CustomRuleDefinition", () => {
  it("constructs with the exact fields it was given", () => {
    const definition = active();

    expect(definition.id).toBe("acme.no-console");
    expect(definition.version.toString()).toBe("1.2.0");
    expect(definition.author).toBe("acme-team");
    expect(definition.status).toBe("active");
    expect(definition.key).toBe("acme.no-console@1.2.0");
  });

  it("rejects an empty id", () => {
    expect(
      unwrapErr(
        CustomRuleDefinition.of({
          id: "  ",
          version: "1.0.0",
          author: "acme",
          status: "draft",
        }),
      ),
    ).toEqual(new InvalidCustomRuleError("rule id must not be empty."));
  });

  it("rejects a malformed version, keeping the version's message", () => {
    expect(
      unwrapErr(
        CustomRuleDefinition.of({
          id: "acme.x",
          version: "latest",
          author: "acme",
          status: "draft",
        }),
      ),
    ).toEqual(
      new InvalidCustomRuleError(
        'rule version must be numeric MAJOR[.MINOR[.PATCH]], got "latest".',
      ),
    );
  });

  it("rejects an empty author", () => {
    expect(
      unwrapErr(
        CustomRuleDefinition.of({
          id: "acme.x",
          version: "1.0.0",
          author: " ",
          status: "draft",
        }),
      ),
    ).toEqual(
      new InvalidCustomRuleError("author/source must not be empty."),
    );
  });

  it("rejects an unknown status", () => {
    expect(
      unwrapErr(
        CustomRuleDefinition.of({
          id: "acme.x",
          version: "1.0.0",
          author: "acme",
          status: "beta" as "draft",
        }),
      ),
    ).toEqual(
      new InvalidCustomRuleError(
        'status must be "draft", "active" or "deprecated", got "beta".',
      ),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidCustomRuleError("boom").name).toBe(
      "InvalidCustomRuleError",
    );
  });
});

describe("isCustomRuleStatus", () => {
  it("accepts exactly the three known statuses", () => {
    expect(isCustomRuleStatus("draft")).toBe(true);
    expect(isCustomRuleStatus("active")).toBe(true);
    expect(isCustomRuleStatus("deprecated")).toBe(true);
    expect(isCustomRuleStatus("beta")).toBe(false);
  });
});

describe("isPublicationAllowed", () => {
  it("allows an active rule with explicit authorization", () => {
    expect(isPublicationAllowed(active(), { authorized: true })).toBe(true);
  });

  it("denies without authorization", () => {
    expect(isPublicationAllowed(active(), { authorized: false })).toBe(false);
  });

  it("denies draft and deprecated rules even when authorized", () => {
    const draft = unwrap(
      CustomRuleDefinition.of({
        id: "acme.x",
        version: "0.1.0",
        author: "acme",
        status: "draft",
      }),
    );
    const deprecated = unwrap(
      CustomRuleDefinition.of({
        id: "acme.x",
        version: "1.0.0",
        author: "acme",
        status: "deprecated",
      }),
    );

    expect(isPublicationAllowed(draft, { authorized: true })).toBe(false);
    expect(isPublicationAllowed(deprecated, { authorized: true })).toBe(false);
  });
});
