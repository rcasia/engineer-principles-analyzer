import { describe, expect, it } from "bun:test";
import {
  ANALYSIS_COMPLETED_EVENT,
  ANALYSIS_FAILED_EVENT,
  ANALYSIS_REQUESTED_EVENT,
} from "./analysis-event.ts";

describe("analysis event type names", () => {
  it("names the requested event", () => {
    expect(ANALYSIS_REQUESTED_EVENT).toBe("AnalysisRequested");
  });

  it("names the completed event", () => {
    expect(ANALYSIS_COMPLETED_EVENT).toBe("AnalysisCompleted");
  });

  it("names the failed event", () => {
    expect(ANALYSIS_FAILED_EVENT).toBe("AnalysisFailed");
  });
});
