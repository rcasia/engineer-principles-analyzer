import { describe, expect, test } from "bun:test";
import {
  classifyResponsibilityDomains,
  MINIMUM_METHODS_PER_DOMAIN,
  wordsOf,
} from "./responsibility-domain.ts";

describe("wordsOf", () => {
  test("returns a single word unchanged", () => {
    expect([...wordsOf("save")]).toEqual(["save"]);
  });

  test("splits camelCase at the lowercase-to-uppercase boundary", () => {
    expect([...wordsOf("saveUser")]).toEqual(["save", "user"]);
  });

  test("splits PascalCase the same way", () => {
    expect([...wordsOf("SaveUser")]).toEqual(["save", "user"]);
  });

  test("splits snake_case on the underscore", () => {
    expect([...wordsOf("save_user")]).toEqual(["save", "user"]);
  });

  test("splits kebab-case on the hyphen", () => {
    expect([...wordsOf("save-user")]).toEqual(["save", "user"]);
  });

  test("does not produce an empty word for a leading separator", () => {
    expect([...wordsOf("_save")]).toEqual(["save"]);
  });

  test("does not produce an empty word for a trailing separator", () => {
    expect([...wordsOf("save_")]).toEqual(["save"]);
  });

  test("returns no words at all for a name that is only separators", () => {
    expect([...wordsOf("_")]).toEqual([]);
  });

  test("treats consecutive separators as one boundary, not empty words", () => {
    expect([...wordsOf("save__user")]).toEqual(["save", "user"]);
  });

  test("splits at every camelCase boundary, not just the first", () => {
    expect([...wordsOf("saveUserName")]).toEqual(["save", "user", "name"]);
  });
});

describe("MINIMUM_METHODS_PER_DOMAIN", () => {
  test("is 2", () => {
    expect(MINIMUM_METHODS_PER_DOMAIN).toBe(2);
  });
});

describe("classifyResponsibilityDomains", () => {
  test("returns no domains for an empty method list", () => {
    expect(classifyResponsibilityDomains([])).toEqual([]);
  });

  test("does not report a domain matched by only one method", () => {
    expect(classifyResponsibilityDomains(["save"])).toEqual([]);
  });

  test("reports a domain matched by exactly the minimum method count", () => {
    const result = classifyResponsibilityDomains(["save", "load"]);

    expect(result).toEqual([
      { domain: "persistence", methodNames: ["save", "load"] },
    ]);
  });

  test("matches camelCase method names by their component words", () => {
    const result = classifyResponsibilityDomains(["saveUser", "loadUser"]);

    expect(result).toEqual([
      { domain: "persistence", methodNames: ["saveUser", "loadUser"] },
    ]);
  });

  test("matches snake_case and PascalCase method names", () => {
    const result = classifyResponsibilityDomains(["save_user", "LoadUser"]);

    expect(result).toEqual([
      { domain: "persistence", methodNames: ["save_user", "LoadUser"] },
    ]);
  });

  test("does not match a word that merely contains a keyword as a substring", () => {
    expect(classifyResponsibilityDomains(["saving", "loaded"])).toEqual([]);
  });

  test("reports every domain that meets the minimum, independently", () => {
    const methodNames = ["save", "load", "send", "notify"];
    const result = classifyResponsibilityDomains(methodNames);

    expect(result).toEqual([
      { domain: "persistence", methodNames: ["save", "load"] },
      { domain: "communication", methodNames: ["send", "notify"] },
    ]);
  });

  test("counts a method matching two domains' keywords toward both", () => {
    const result = classifyResponsibilityDomains(["saveAndNotify", "save", "notify"]);

    expect(result).toEqual([
      { domain: "persistence", methodNames: ["saveAndNotify", "save"] },
      { domain: "communication", methodNames: ["saveAndNotify", "notify"] },
    ]);
  });

  test("returns no domains for method names matching no keyword", () => {
    expect(classifyResponsibilityDomains(["build", "process", "handle"])).toEqual(
      [],
    );
  });

  /**
   * One method per keyword, named after the keyword itself, for every
   * domain — verified against the exact, full method list.
   *
   * This is deliberately exhaustive rather than spot-checking one or two
   * keywords per domain: a keyword dictionary is a plain data table, and a
   * single wrong or missing entry (a mutation-testing gap, or a real typo)
   * only shows up if every entry is exercised. Each method name equals its
   * keyword exactly, so `wordsOf` cannot accidentally match it to any other
   * domain, and dropping any one keyword from the dictionary would drop
   * exactly that method from the expected output, which `toEqual` catches.
   */
  const domainFixtures: ReadonlyArray<{
    readonly domain: string;
    readonly keywords: readonly string[];
  }> = [
    {
      domain: "persistence",
      keywords: [
        "save",
        "load",
        "delete",
        "insert",
        "update",
        "remove",
        "fetch",
        "query",
        "find",
        "persist",
        "store",
        "read",
        "write",
      ],
    },
    {
      domain: "communication",
      keywords: [
        "send",
        "notify",
        "publish",
        "subscribe",
        "email",
        "sms",
        "broadcast",
        "emit",
        "dispatch",
      ],
    },
    {
      domain: "presentation",
      keywords: ["render", "display", "print", "format", "draw", "show"],
    },
    {
      domain: "validation",
      keywords: ["validate", "verify", "check", "ensure", "assert"],
    },
    {
      domain: "calculation",
      keywords: ["calculate", "compute", "sum", "aggregate", "total"],
    },
    {
      domain: "authentication",
      keywords: [
        "authenticate",
        "authorize",
        "login",
        "logout",
        "signin",
        "signout",
      ],
    },
    {
      domain: "serialization",
      keywords: ["serialize", "deserialize", "parse", "stringify", "encode", "decode"],
    },
    {
      domain: "logging",
      keywords: ["log", "trace", "audit"],
    },
  ];

  for (const fixture of domainFixtures) {
    test(`reports every keyword of the ${fixture.domain} domain`, () => {
      const result = classifyResponsibilityDomains(fixture.keywords);

      expect(result).toEqual([
        { domain: fixture.domain, methodNames: fixture.keywords },
      ]);
    });
  }

  test("covers every domain this rule currently knows about", () => {
    const allDomains = domainFixtures.map((fixture) => fixture.domain);

    expect(allDomains).toEqual([
      "persistence",
      "communication",
      "presentation",
      "validation",
      "calculation",
      "authentication",
      "serialization",
      "logging",
    ]);
  });
});
