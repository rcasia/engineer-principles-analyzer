import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { unwrap } from "../../shared/result.ts";
import {
  customRuleEntry,
  InMemoryCustomRuleCatalog,
} from "./in-memory-custom-rule-catalog.ts";

function compliant(): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: "acme.first",
      status: "compliant",
      confidence: unwrap(Confidence.of(1)),
      method: "deterministic",
      evidence: [],
      explanation: "Clean.",
      language: "typescript",
      analyzer: { name: "test-custom", version: "1.0.0" },
      humanReviewRecommended: false,
    }),
  );
}

describe("InMemoryCustomRuleCatalog", () => {
  it("ships no rules and no definitions by default", async () => {
    const catalog = new InMemoryCustomRuleCatalog();

    expect(await catalog.rules()).toEqual([]);
    expect(await catalog.definition("acme.first", "1.0.0")).toBeUndefined();
  });

  it("returns the rules it was seeded with", async () => {
    const entry = customRuleEntry({
      id: "acme.first",
      version: "1.0.0",
      author: "acme",
      status: "active",
      evaluate: () => Promise.resolve(compliant()),
    });
    const catalog = new InMemoryCustomRuleCatalog([entry]);

    expect(await catalog.rules()).toHaveLength(1);
    expect((await catalog.rules())[0]?.id).toBe("acme.first");
    expect((await catalog.rules())[0]?.version).toBe("1.0.0");
  });

  it("resolves a definition by exact id and version", async () => {
    const catalog = new InMemoryCustomRuleCatalog([
      customRuleEntry({
        id: "acme.first",
        version: "1.0.0",
        author: "acme",
        status: "active",
        evaluate: () => Promise.resolve(compliant()),
      }),
    ]);

    expect((await catalog.definition("acme.first", "1.0.0"))?.key).toBe(
      "acme.first@1.0.0",
    );
    expect(await catalog.definition("acme.first", "2.0.0")).toBeUndefined();
    expect(await catalog.definition("acme.other", "1.0.0")).toBeUndefined();
  });
});

describe("customRuleEntry", () => {
  it("builds a consistent definition and rule pair", () => {
    const entry = customRuleEntry({
      id: "acme.first",
      version: "1.0.0",
      author: "acme",
      status: "draft",
      evaluate: () => Promise.resolve(compliant()),
    });

    expect(entry.definition.key).toBe("acme.first@1.0.0");
    expect(entry.definition.status).toBe("draft");
    expect(entry.rule.id).toBe("acme.first");
    expect(entry.rule.version).toBe("1.0.0");
    expect(entry.rule.author).toBe("acme");
  });
});
