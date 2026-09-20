import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import { Subject } from "../../engine/domain/subject.ts";
import { unwrap } from "../../shared/result.ts";
import type { VersionedRule } from "./versioned-rule.port.ts";
import { TestCustomRule } from "./test-rule-fixtures.use-case.ts";

function subject(sourceCode: string): Subject {
  return unwrap(Subject.of({ sourceCode, language: "typescript" }));
}

function verdict(ruleId: string, status: "compliant" | "violation"): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId,
      status,
      confidence: unwrap(Confidence.of(1)),
      method: "deterministic",
      evidence:
        status === "violation"
          ? [
              unwrap(
                Evidence.of({
                  location: unwrap(SourceLocation.of({ startLine: 1 })),
                  excerpt: "console.log(x);",
                }),
              ),
            ]
          : [],
      explanation: status === "violation" ? "Found it." : "Clean.",
      language: "typescript",
      analyzer: { name: "test-custom", version: "1.0.0" },
      humanReviewRecommended: false,
    }),
  );
}

const violationRule: VersionedRule = {
  id: "acme.no-console",
  version: "1.0.0",
  author: "acme",
  evaluate: (candidate) =>
    Promise.resolve(
      verdict(
        "acme.no-console",
        candidate.sourceCode.includes("console") ? "violation" : "compliant",
      ),
    ),
};

const throwingRule: VersionedRule = {
  id: "acme.broken",
  version: "1.0.0",
  author: "acme",
  evaluate: () => Promise.reject(new Error("broken rule")),
};

describe("TestCustomRule", () => {
  it("passes when every fixture matches", async () => {
    const evaluation = await new TestCustomRule().execute({
      rule: violationRule,
      fixtures: [
        {
          name: "flags console.log",
          subject: subject("console.log(x);"),
          expectedStatus: "violation",
        },
        {
          name: "passes clean code",
          subject: subject("const x = 1;"),
          expectedStatus: "compliant",
        },
      ],
    });

    expect(evaluation).toEqual({
      ruleId: "acme.no-console",
      ruleVersion: "1.0.0",
      passed: true,
      passedCount: 2,
      totalCount: 2,
      outcomes: [
        {
          name: "flags console.log",
          expected: "violation",
          actual: "violation",
          match: true,
        },
        {
          name: "passes clean code",
          expected: "compliant",
          actual: "compliant",
          match: true,
        },
      ],
    });
  });

  it("fails the fixtures the rule gets wrong", async () => {
    const evaluation = await new TestCustomRule().execute({
      rule: violationRule,
      fixtures: [
        {
          name: "expects a violation it cannot produce",
          subject: subject("const x = 1;"),
          expectedStatus: "violation",
        },
      ],
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.passedCount).toBe(0);
    expect(evaluation.totalCount).toBe(1);
    expect(evaluation.outcomes).toEqual([
      {
        name: "expects a violation it cannot produce",
        expected: "violation",
        actual: "compliant",
        match: false,
      },
    ]);
  });

  it("marks a throwing rule as unable_to_analyze, not as a match", async () => {
    const evaluation = await new TestCustomRule().execute({
      rule: throwingRule,
      fixtures: [
        {
          name: "whatever it does",
          subject: subject("const x = 1;"),
          expectedStatus: "unable_to_analyze",
        },
      ],
    });

    expect(evaluation.outcomes).toEqual([
      {
        name: "whatever it does",
        expected: "unable_to_analyze",
        actual: "unable_to_analyze",
        match: true,
      },
    ]);
    expect(evaluation.passed).toBe(true);
  });

  it("marks a contract-breaking rule as unable_to_analyze", async () => {
    const bad: VersionedRule = {
      id: "acme.bad",
      version: "1.0.0",
      author: "acme",
      evaluate: (() =>
        Promise.resolve("nope")) as unknown as VersionedRule["evaluate"],
    };

    const evaluation = await new TestCustomRule().execute({
      rule: bad,
      fixtures: [
        {
          name: "bad return",
          subject: subject("const x = 1;"),
          expectedStatus: "compliant",
        },
      ],
    });

    expect(evaluation.passed).toBe(false);
    expect(evaluation.outcomes[0]).toEqual({
      name: "bad return",
      expected: "compliant",
      actual: "unable_to_analyze",
      match: false,
    });
  });
});
