import { describe, expect, test } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import type { Rule } from "../../engine/application/rule.port.ts";
import { AnalyzeSubject } from "../../engine/application/analyze-subject.use-case.ts";
import type { Subject } from "../../engine/domain/subject.ts";
import { InMemoryRuleCatalog } from "../../engine/infrastructure/in-memory-rule-catalog.ts";
import { unwrap } from "../../shared/result.ts";
import type { CorpusEntry } from "../domain/corpus-entry.ts";
import { EvaluateCorpus } from "./evaluate-corpus.use-case.ts";

function entryOf(
  ruleId: string,
  expected: CorpusEntry["expected"],
  language = "typescript",
  sourceCode = "const x = 1;",
): CorpusEntry {
  return {
    id: `${ruleId}.${expected}.fixture`,
    ruleId,
    language,
    sourceCode,
    expected,
    note: "A stub fixture.",
  };
}

function stubRule(
  ruleId: string,
  verdict: "violation" | "compliant" | "uncertain",
  confidenceValue: number,
): Rule {
  return {
    id: ruleId,
    async evaluate(subject: Subject): Promise<AnalysisResult> {
      return unwrap(
        AnalysisResult.of({
          ruleId,
          status: verdict,
          confidence: unwrap(Confidence.of(confidenceValue)),
          method: "heuristic",
          evidence:
            verdict === "violation"
              ? [
                  unwrap(
                    Evidence.of({
                      location: unwrap(SourceLocation.of({ startLine: 1 })),
                      excerpt: "stub evidence",
                    }),
                  ),
                ]
              : [],
          explanation: "A stub verdict.",
          language: subject.language,
          analyzer: { name: "stub", version: "1" },
          humanReviewRecommended: verdict !== "compliant",
        }),
      );
    },
  };
}

function harnessWith(rules: readonly Rule[]): EvaluateCorpus {
  return new EvaluateCorpus(new AnalyzeSubject(new InMemoryRuleCatalog(rules)));
}

describe("EvaluateCorpus", () => {
  test("scores a perfect rule with exact ones and zeros", async () => {
    const rule: Rule = {
      id: "stub.rule",
      async evaluate(subject: Subject): Promise<AnalysisResult> {
        const verdict = subject.sourceCode.includes("bad")
          ? "violation"
          : "compliant";

        return unwrap(
          AnalysisResult.of({
            ruleId: "stub.rule",
            status: verdict,
            confidence: unwrap(
              Confidence.of(verdict === "violation" ? 0.55 : 0.65),
            ),
            method: "heuristic",
            evidence:
              verdict === "violation"
                ? [
                    unwrap(
                      Evidence.of({
                        location: unwrap(SourceLocation.of({ startLine: 1 })),
                        excerpt: "stub evidence",
                      }),
                    ),
                  ]
                : [],
            explanation: "A stub verdict.",
            language: subject.language,
            analyzer: { name: "stub", version: "1" },
            humanReviewRecommended: verdict !== "compliant",
          }),
        );
      },
    };
    const harness = harnessWith([rule]);
    const { qualities } = await harness.execute({
      entries: [
        entryOf("stub.rule", "violation", "typescript", "bad input"),
        entryOf("stub.rule", "compliant", "typescript", "good input"),
      ],
    });

    expect(qualities).toHaveLength(1);
    expect(qualities[0]?.ruleId).toBe("stub.rule");
    expect(qualities[0]?.language).toBe("typescript");
    expect(qualities[0]?.precision).toBe(1);
    expect(qualities[0]?.recall).toBe(1);
    expect(qualities[0]?.falsePositiveRate).toBe(0);
    expect(qualities[0]?.falseNegativeRate).toBe(0);
    expect(qualities[0]?.sampleSize).toBe(2);
    expect(qualities[0]?.evidenceCoverage).toBe(0.5);
  });

  test("counts an uncertain verdict on a violation fixture as a false negative", async () => {
    const harness = harnessWith([
      stubRule("stub.rule", "uncertain", 0.4),
    ]);
    const { qualities } = await harness.execute({
      entries: [entryOf("stub.rule", "violation")],
    });

    expect(qualities[0]?.precision).toBeNull();
    expect(qualities[0]?.recall).toBe(0);
    expect(qualities[0]?.falseNegativeRate).toBe(1);
    expect(qualities[0]?.falsePositiveRate).toBeNull();
  });

  test("counts an uncertain verdict on a compliant fixture as a false positive", async () => {
    const harness = harnessWith([
      stubRule("stub.rule", "uncertain", 0.4),
    ]);
    const { qualities } = await harness.execute({
      entries: [entryOf("stub.rule", "compliant")],
    });

    expect(qualities[0]?.precision).toBe(0);
    expect(qualities[0]?.recall).toBeNull();
    expect(qualities[0]?.falsePositiveRate).toBe(1);
    expect(qualities[0]?.falseNegativeRate).toBeNull();
  });

  test("groups qualities by rule and language in first-seen order", async () => {
    const harness = harnessWith([
      stubRule("stub.a", "violation", 0.55),
      stubRule("stub.b", "compliant", 0.65),
    ]);
    const { qualities } = await harness.execute({
      entries: [
        entryOf("stub.a", "violation", "typescript"),
        entryOf("stub.b", "compliant", "javascript"),
        entryOf("stub.a", "violation", "javascript"),
      ],
    });

    expect(
      qualities.map((quality) => `${quality.ruleId} ${quality.language}`),
    ).toEqual(["stub.a typescript", "stub.b javascript", "stub.a javascript"]);
    expect(qualities.map((quality) => quality.sampleSize)).toEqual([1, 1, 1]);
  });

  test("reports mean confidence, calibration gap and evidence coverage", async () => {
    const harness = harnessWith([
      stubRule("stub.rule", "violation", 0.55),
    ]);
    const { qualities } = await harness.execute({
      entries: [entryOf("stub.rule", "violation")],
    });

    expect(qualities[0]?.meanConfidence).toBe(0.55);
    expect(qualities[0]?.calibrationGap).toBeCloseTo(0.45, 10);
    expect(qualities[0]?.evidenceCoverage).toBe(1);
  });

  test("fails loudly when the engine returns no result for a rule", async () => {
    const empty = new EvaluateCorpus({
      execute: () => Promise.resolve({ results: [] }),
    } as unknown as AnalyzeSubject);

    const error = await empty
      .execute({ entries: [entryOf("stub.missing", "violation")] })
      .then(
        () => {
          throw new Error("expected EvaluateCorpus to throw");
        },
        (thrown: unknown) => thrown as Error,
      );

    expect(error.message).toBe(
      'EvaluateCorpus: engine returned no result for rule "stub.missing".',
    );
  });

  test("leaves calibration gap null when precision is unmeasurable", async () => {
    const harness = harnessWith([
      stubRule("stub.rule", "uncertain", 0.4),
    ]);
    const { qualities } = await harness.execute({
      entries: [entryOf("stub.rule", "violation")],
    });

    expect(qualities[0]?.meanConfidence).toBe(0.4);
    expect(qualities[0]?.calibrationGap).toBeNull();
  });
});
