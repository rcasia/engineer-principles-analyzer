import { describe, expect, it } from "bun:test";
import {
  AnalysisResult,
  Confidence,
  Evidence,
  SourceLocation,
  unwrap,
} from "@principled/core";
import {
  LIVE_RESULTS_EMPTY_MESSAGE,
  LIVE_STATUS_ANALYZING,
  LIVE_STATUS_ATTENTION,
  LIVE_STATUS_EMPTY,
  LIVE_STATUS_READY,
  NO_FINDINGS_MESSAGE,
  PROBABILISTIC_NOTE,
  toPlainResult,
} from "./analysis-payload.ts";

describe("toPlainResult", () => {
  it("maps every scalar field of a bare result", () => {
    const result = unwrap(
      AnalysisResult.of({
        ruleId: "solid.srp",
        status: "compliant",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [],
        explanation: "Looks fine.",
        language: "typescript",
        analyzer: { name: "fake-analyzer", version: "0.0.0" },
        humanReviewRecommended: false,
      }),
    );

    expect(toPlainResult(result)).toEqual({
      ruleId: "solid.srp",
      status: "compliant",
      confidence: 1,
      method: "deterministic",
      evidence: [],
      explanation: "Looks fine.",
      language: "typescript",
      analyzer: { name: "fake-analyzer", version: "0.0.0" },
      limitations: [],
      humanReviewRecommended: false,
    });
  });

  it("maps evidence with columns and file paths", () => {
    const result = unwrap(
      AnalysisResult.of({
        ruleId: "solid.srp",
        status: "violation",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [
          unwrap(
            Evidence.of({
              location: unwrap(
                SourceLocation.of({
                  filePath: "UserService.ts",
                  startLine: 5,
                  endLine: 8,
                  startColumn: 7,
                }),
              ),
              excerpt: "class Foo {}",
            }),
          ),
        ],
        explanation: "Too much.",
        language: "typescript",
        analyzer: { name: "fake-analyzer", version: "0.0.0" },
        humanReviewRecommended: false,
      }),
    );

    expect(toPlainResult(result).evidence).toEqual([
      {
        location: {
          startLine: 5,
          endLine: 8,
          startColumn: 7,
          filePath: "UserService.ts",
        },
        excerpt: "class Foo {}",
      },
    ]);
  });

  it("carries remediation, limitations and evaluation metadata when present", () => {    const result = unwrap(
      AnalysisResult.of({
        ruleId: "solid.srp",
        status: "uncertain",
        confidence: unwrap(Confidence.of(0.5)),
        method: "heuristic",
        evidence: [],
        explanation: "Maybe.",
        remediation: "Split this class.",
        language: "python",
        analyzer: { name: "fake-analyzer", version: "0.0.0" },
        limitations: ["Limited context"],
        humanReviewRecommended: true,
        evaluationMetadata: { corpus: "solid-v1" },
      }),
    );

    const plain = toPlainResult(result);

    expect(plain.remediation).toBe("Split this class.");
    expect(plain.limitations).toEqual(["Limited context"]);
    expect(plain.evaluationMetadata).toEqual({ corpus: "solid-v1" });
    expect(plain.confidence).toBe(0.5);
  });

  it("omits the optional fields entirely when they are absent", () => {
    const result = unwrap(
      AnalysisResult.of({
        ruleId: "solid.srp",
        status: "compliant",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [
          unwrap(
            Evidence.of({
              location: unwrap(SourceLocation.of({ startLine: 1 })),
              excerpt: "x",
            }),
          ),
        ],
        explanation: "Looks fine.",
        language: "typescript",
        analyzer: { name: "fake-analyzer", version: "0.0.0" },
        humanReviewRecommended: false,
      }),
    );

    const plain = toPlainResult(result);

    expect("remediation" in plain).toBe(false);
    expect("evaluationMetadata" in plain).toBe(false);
    expect(Object.keys(plain.evidence[0]?.location ?? {}).sort()).toEqual([
      "endLine",
      "startLine",
    ]);
  });

  it("round-trips through JSON without losing the optional fields", () => {
    const result = unwrap(
      AnalysisResult.of({
        ruleId: "solid.srp",
        status: "uncertain",
        confidence: unwrap(Confidence.of(0.5)),
        method: "heuristic",
        evidence: [],
        explanation: "Maybe.",
        remediation: "Split this class.",
        language: "python",
        analyzer: { name: "fake-analyzer", version: "0.0.0" },
        limitations: ["Limited context"],
        humanReviewRecommended: true,
        evaluationMetadata: { corpus: "solid-v1" },
      }),
    );

    expect(JSON.parse(JSON.stringify(toPlainResult(result)))).toEqual(
      toPlainResult(result),
    );
  });
});

describe("live status strings", () => {
  it("pins every user-facing literal the island and the page share", () => {
    expect(LIVE_RESULTS_EMPTY_MESSAGE).toBe(
      "Findings appear here as you type — paste code, upload a file, or try an example.",
    );
    expect(LIVE_STATUS_EMPTY).toBe("Waiting for code.");
    expect(LIVE_STATUS_ANALYZING).toBe("Analyzing…");
    expect(LIVE_STATUS_READY).toBe("Findings up to date.");
    expect(LIVE_STATUS_ATTENTION).toBe("Analysis paused — see below.");
    expect(NO_FINDINGS_MESSAGE).toBe(
      "The analysis completed, but no rules were available to evaluate this submission.",
    );
    expect(PROBABILISTIC_NOTE).toBe(
      "Findings are heuristic or AI-assisted judgments, not compiler errors. Confirm before acting.",
    );
  });
});
