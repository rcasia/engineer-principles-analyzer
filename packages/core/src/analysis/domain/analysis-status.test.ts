import { describe, expect, it } from "bun:test";
import { ANALYSIS_STATUSES, isAnalysisStatus } from "./analysis-status.ts";

describe("ANALYSIS_STATUSES", () => {
  it("lists exactly the five statuses the contract defines", () => {
    expect(ANALYSIS_STATUSES).toEqual([
      "compliant",
      "violation",
      "uncertain",
      "not_applicable",
      "unable_to_analyze",
    ]);
  });
});

describe("isAnalysisStatus", () => {
  it.each([...ANALYSIS_STATUSES])("accepts %p", (status) => {
    expect(isAnalysisStatus(status)).toBe(true);
  });

  it.each(["passing", "failing", "", "Violation", "VIOLATION"])(
    "rejects %p",
    (value) => {
      expect(isAnalysisStatus(value)).toBe(false);
    },
  );
});
