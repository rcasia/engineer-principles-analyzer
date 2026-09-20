import { describe, expect, test } from "bun:test";
import {
  AnalysisResult,
  Confidence,
  Evidence,
  SourceLocation,
  unwrap,
} from "@principled/core";
import { toPlainResult } from "./serialize-result.ts";

function locationOf(props: {
  filePath?: string;
  startLine: number;
  endLine?: number;
  startColumn?: number;
}) {
  return unwrap(SourceLocation.of(props));
}

function resultOf(overrides: Record<string, unknown> = {}) {
  return unwrap(
    AnalysisResult.of({
      ruleId: "solid.srp",
      status: "compliant",
      confidence: unwrap(Confidence.of(0.5)),
      method: "heuristic",
      evidence: [],
      explanation: "The class has a single responsibility.",
      language: "typescript",
      analyzer: { name: "principled-test", version: "9.9.9" },
      humanReviewRecommended: false,
      ...overrides,
    }),
  );
}

describe("toPlainResult", () => {
  test("serializes a bare result with no optional fields set", () => {
    const plain = toPlainResult(resultOf());

    expect(plain).toEqual({
      ruleId: "solid.srp",
      status: "compliant",
      confidence: 0.5,
      method: "heuristic",
      evidence: [],
      explanation: "The class has a single responsibility.",
      language: "typescript",
      analyzer: { name: "principled-test", version: "9.9.9" },
      limitations: [],
      humanReviewRecommended: false,
    });
    expect("remediation" in plain).toBe(false);
    expect("evaluationMetadata" in plain).toBe(false);
  });

  test("carries evidence locations without columns or file paths", () => {
    const plain = toPlainResult(
      resultOf({
        status: "violation",
        evidence: [
          unwrap(
            Evidence.of({
              location: locationOf({ startLine: 3, endLine: 5 }),
              excerpt: "class Bag {}",
            }),
          ),
        ],
      }),
    );

    expect(plain.evidence).toEqual([
      {
        location: { startLine: 3, endLine: 5 },
        excerpt: "class Bag {}",
      },
    ]);
    const location = plain.evidence[0]?.location ?? {};
    expect("startColumn" in location).toBe(false);
    expect("filePath" in location).toBe(false);
  });

  test("carries a startColumn when the location pins one", () => {
    const plain = toPlainResult(
      resultOf({
        status: "violation",
        evidence: [
          unwrap(
            Evidence.of({
              location: locationOf({
                startLine: 3,
                endLine: 3,
                startColumn: 2,
              }),
              excerpt: "class Bag {}",
            }),
          ),
        ],
      }),
    );

    expect(plain.evidence).toEqual([
      {
        location: { startLine: 3, endLine: 3, startColumn: 2 },
        excerpt: "class Bag {}",
      },
    ]);
  });

  test("carries a filePath when the location names one", () => {
    const plain = toPlainResult(
      resultOf({
        status: "violation",
        evidence: [
          unwrap(
            Evidence.of({
              location: locationOf({
                filePath: "src/bag.ts",
                startLine: 3,
              }),
              excerpt: "class Bag {}",
            }),
          ),
        ],
      }),
    );

    expect(plain.evidence).toEqual([
      {
        location: { startLine: 3, endLine: 3, filePath: "src/bag.ts" },
        excerpt: "class Bag {}",
      },
    ]);
  });

  test("carries remediation, limitations, and evaluationMetadata when set", () => {
    const plain = toPlainResult(
      resultOf({
        remediation: "Extract the second responsibility into its own class.",
        limitations: ["Limited to a single file of context."],
        evaluationMetadata: { corpus: "solid-v1" },
      }),
    );

    expect(plain.remediation).toBe(
      "Extract the second responsibility into its own class.",
    );
    expect(plain.limitations).toEqual([
      "Limited to a single file of context.",
    ]);
    expect(plain.evaluationMetadata).toEqual({ corpus: "solid-v1" });
  });

  test("copies limitations and evaluationMetadata instead of aliasing them", () => {
    const limitations = ["Limited to a single file of context."];
    const evaluationMetadata: Record<string, string> = { corpus: "solid-v1" };
    const plain = toPlainResult(
      resultOf({ limitations, evaluationMetadata }),
    );

    limitations.push("Another limitation.");
    evaluationMetadata.corpus = "solid-v2";

    expect(plain.limitations).toEqual([
      "Limited to a single file of context.",
    ]);
    expect(plain.evaluationMetadata).toEqual({ corpus: "solid-v1" });
  });

  test("serializes every evidence item, not just the first", () => {
    const plain = toPlainResult(
      resultOf({
        status: "violation",
        evidence: [
          unwrap(
            Evidence.of({
              location: locationOf({ startLine: 1 }),
              excerpt: "class One {}",
            }),
          ),
          unwrap(
            Evidence.of({
              location: locationOf({ startLine: 9 }),
              excerpt: "class Two {}",
            }),
          ),
        ],
      }),
    );

    expect(plain.evidence).toEqual([
      { location: { startLine: 1, endLine: 1 }, excerpt: "class One {}" },
      { location: { startLine: 9, endLine: 9 }, excerpt: "class Two {}" },
    ]);
  });

  test("emits no source, user, or telemetry fields", () => {
    const raw = JSON.stringify(
      toPlainResult(
        resultOf({
          status: "violation",
          evidence: [
            unwrap(
              Evidence.of({
                location: locationOf({ startLine: 1 }),
                excerpt: "class One {}",
              }),
            ),
          ],
        }),
      ),
    );

    for (const field of [
      "sourceCode",
      "user",
      "telemetry",
      "tracking",
      "hostname",
      "username",
      "email",
      "token",
    ]) {
      expect(raw).not.toContain(`"${field}"`);
    }
  });
});
