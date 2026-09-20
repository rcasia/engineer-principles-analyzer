import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { InvalidProjectMetricsError, ProjectMetrics } from "./project-metrics.ts";

function props() {
  return {
    fileCount: 4,
    analyzedFileCount: 3,
    graphCoverage: 0.75,
    findingsWithCrossFileEvidence: 1,
    totalFindings: 2,
    durationMs: 120,
  };
}

describe("ProjectMetrics", () => {
  it("constructs with the exact values it was given", () => {
    const metrics = unwrap(ProjectMetrics.of(props()));

    expect(metrics.fileCount).toBe(4);
    expect(metrics.analyzedFileCount).toBe(3);
    expect(metrics.graphCoverage).toBe(0.75);
    expect(metrics.durationMs).toBe(120);
  });

  it("derives file coverage as the analyzed fraction", () => {
    expect(unwrap(ProjectMetrics.of(props())).fileCoverage).toBe(0.75);
  });

  it("derives cross-file evidence coverage as the evidenced fraction", () => {
    expect(unwrap(ProjectMetrics.of(props())).crossFileEvidenceCoverage).toBe(0.5);
  });

  it("reports full evidence coverage when there are no findings", () => {
    const metrics = unwrap(
      ProjectMetrics.of({
        ...props(),
        findingsWithCrossFileEvidence: 0,
        totalFindings: 0,
      }),
    );

    expect(metrics.crossFileEvidenceCoverage).toBe(1);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects %p as fileCount",
    (fileCount) => {
      expect(
        unwrapErr(ProjectMetrics.of({ ...props(), fileCount })),
      ).toEqual(
        new InvalidProjectMetricsError(
          "fileCount must be a positive integer.",
        ),
      );
    },
  );

  it.each([-1, 5, 2.5])(
    "rejects %p as analyzedFileCount outside 0..fileCount",
    (analyzedFileCount) => {
      expect(
        unwrapErr(ProjectMetrics.of({ ...props(), analyzedFileCount })),
      ).toEqual(
        new InvalidProjectMetricsError(
          "analyzedFileCount must be an integer between 0 and fileCount.",
        ),
      );
    },
  );

  it.each([-0.1, 1.1, Number.NaN])(
    "rejects %p as graphCoverage outside [0, 1]",
    (graphCoverage) => {
      expect(
        unwrapErr(ProjectMetrics.of({ ...props(), graphCoverage })),
      ).toEqual(
        new InvalidProjectMetricsError("graphCoverage must be a number in [0, 1]."),
      );
    },
  );

  it("rejects a non-integer cross-file evidence count", () => {
    expect(
      unwrapErr(
        ProjectMetrics.of({
          ...props(),
          findingsWithCrossFileEvidence: 1.5,
          totalFindings: 2,
        }),
      ),
    ).toEqual(
      new InvalidProjectMetricsError(
        "findingsWithCrossFileEvidence must be a non-negative integer.",
      ),
    );
    expect(
      unwrapErr(
        ProjectMetrics.of({
          ...props(),
          findingsWithCrossFileEvidence: -1,
          totalFindings: 2,
        }),
      ),
    ).toEqual(
      new InvalidProjectMetricsError(
        "findingsWithCrossFileEvidence must be a non-negative integer.",
      ),
    );
  });

  it("accepts the boundary values both predicates admit", () => {
    const metrics = unwrap(
      ProjectMetrics.of({
        fileCount: 1,
        analyzedFileCount: 1,
        graphCoverage: 0,
        findingsWithCrossFileEvidence: 0,
        totalFindings: 0,
        durationMs: 0,
      }),
    );

    expect(metrics.fileCount).toBe(1);
    expect(metrics.graphCoverage).toBe(0);
  });

  it("rejects evidence counts above the finding total", () => {
    expect(
      unwrapErr(
        ProjectMetrics.of({
          ...props(),
          findingsWithCrossFileEvidence: 3,
          totalFindings: 2,
        }),
      ),
    ).toEqual(
      new InvalidProjectMetricsError(
        "totalFindings must be an integer at or above findingsWithCrossFileEvidence.",
      ),
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %p as durationMs",
    (durationMs) => {
      expect(unwrapErr(ProjectMetrics.of({ ...props(), durationMs }))).toEqual(
        new InvalidProjectMetricsError(
          "durationMs must be a finite number at or above 0.",
        ),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidProjectMetricsError("boom").name).toBe(
      "InvalidProjectMetricsError",
    );
  });
});
