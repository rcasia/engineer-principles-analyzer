import { describe, expect, it } from "bun:test";
import { ANALYSIS_METHODS, isAnalysisMethod } from "./analysis-method.ts";

describe("ANALYSIS_METHODS", () => {
  it("lists exactly the three methods the contract defines", () => {
    expect(ANALYSIS_METHODS).toEqual([
      "deterministic",
      "heuristic",
      "ai_assisted",
    ]);
  });
});

describe("isAnalysisMethod", () => {
  it.each([...ANALYSIS_METHODS])("accepts %p", (method) => {
    expect(isAnalysisMethod(method)).toBe(true);
  });

  it.each(["ai", "static", "", "Deterministic", "AI_ASSISTED"])(
    "rejects %p",
    (value) => {
      expect(isAnalysisMethod(value)).toBe(false);
    },
  );
});
