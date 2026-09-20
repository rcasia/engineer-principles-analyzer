import { describe, expect, test } from "bun:test";
import { AnalyzeSubject, InMemoryRuleCatalog, SrpRule } from "@principled/core";
import { AnalysisResult } from "@principled/core";
import { Confidence } from "@principled/core";
import { Evidence } from "@principled/core";
import { SourceLocation } from "@principled/core";
import { unwrap } from "@principled/core";
import { Subject } from "@principled/core";
import { renderFindings } from "./render-analysis.ts";

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

describe("renderFindings", () => {
  test("says so when no rule ran", () => {
    expect(renderFindings([])).toBe(
      "No rules were available to evaluate this input.",
    );
  });

  test("renders one block per result with status and rationale", async () => {
    const analyze = new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule()]),
    );
    const run = await analyze.execute({
      subject: unwrap(
        Subject.of({ sourceCode: VIOLATING_TS, language: "typescript" }),
      ),
    });

    const text = renderFindings(run.results);

    expect(text).toContain("violation solid.srp (55% confidence, heuristic)");
    expect(text).toContain(
      "Found method-name evidence of concentrated responsibility.",
    );
    expect(text).toContain("evidence lines 1-8: class UserManager { … }");
    expect(text).toContain("suggested fix: Consider splitting responsibilities:");
    expect(text).toContain("human review recommended");
  });

  test("renders a single-line span as one line", () => {
    const text = renderFindings([
      singleLineViolation(),
    ]);

    expect(text).toBe(
      "violation solid.srp (50% confidence, heuristic)\n" +
        "The class has a single responsibility.\n" +
        "evidence line 4: class Bag {}",
    );
  });

  test("omits the fix and review lines when the result has neither", () => {
    const text = renderFindings([bareCompliant()]);

    expect(text).toBe(
      "compliant solid.srp (90% confidence, heuristic)\n" +
        "The class has a single responsibility.",
    );
    expect(text).not.toContain("suggested fix:");
    expect(text).not.toContain("human review recommended");
  });

  test("separates result blocks with a blank line", () => {
    const text = renderFindings([bareCompliant(), bareCompliant()]);

    expect(text).toBe(
      "compliant solid.srp (90% confidence, heuristic)\n" +
        "The class has a single responsibility.\n" +
        "\n" +
        "compliant solid.srp (90% confidence, heuristic)\n" +
        "The class has a single responsibility.",
    );
  });
});

function singleLineViolation() {
  return unwrap(
    AnalysisResult.of({
      ruleId: "solid.srp",
      status: "violation",
      confidence: unwrap(Confidence.of(0.5)),
      method: "heuristic",
      evidence: [
        unwrap(
          Evidence.of({
            location: unwrap(
              SourceLocation.of({ startLine: 4, endLine: 4 }),
            ),
            excerpt: "class Bag {}",
          }),
        ),
      ],
      explanation: "The class has a single responsibility.",
      language: "typescript",
      analyzer: { name: "principled-test", version: "1.0.0" },
      humanReviewRecommended: false,
    }),
  );
}

function bareCompliant() {
  return unwrap(
    AnalysisResult.of({
      ruleId: "solid.srp",
      status: "compliant",
      confidence: unwrap(Confidence.of(0.9)),
      method: "heuristic",
      evidence: [],
      explanation: "The class has a single responsibility.",
      language: "typescript",
      analyzer: { name: "principled-test", version: "1.0.0" },
      humanReviewRecommended: false,
    }),
  );
}
