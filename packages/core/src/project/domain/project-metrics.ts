import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidProjectMetricsError extends Error {
  override readonly name = "InvalidProjectMetricsError";
}

export interface ProjectMetricsProps {
  /** Files in the project. */
  readonly fileCount: number;
  /** Files the run actually analyzed. */
  readonly analyzedFileCount: number;
  /** Fraction of project files the dependency graph knows about, in [0, 1]. */
  readonly graphCoverage: number;
  /** Findings backed by evidence spanning more than one file. */
  readonly findingsWithCrossFileEvidence: number;
  /** Findings in total. */
  readonly totalFindings: number;
  /** Wall-clock analysis duration in milliseconds. */
  readonly durationMs: number;
}

/**
 * Project-level metrics (#22 "Scope and metrics"): file coverage,
 * dependency-graph coverage, cross-file evidence coverage, and analysis
 * duration by repository size.
 *
 * Immutable value object: the only way to obtain one is
 * {@link ProjectMetrics.of}. Architecture-rule precision/recall is reported
 * by the evaluation framework (#30), not stored here — this value carries
 * the run's own coverage facts, never a user-tracking field.
 */
export class ProjectMetrics {
  private constructor(
    readonly fileCount: number,
    readonly analyzedFileCount: number,
    readonly graphCoverage: number,
    readonly findingsWithCrossFileEvidence: number,
    readonly totalFindings: number,
    readonly durationMs: number,
  ) {}

  static of(
    props: ProjectMetricsProps,
  ): Result<ProjectMetrics, InvalidProjectMetricsError> {
    if (!isPositiveInteger(props.fileCount)) {
      return err(
        new InvalidProjectMetricsError("fileCount must be a positive integer."),
      );
    }

    if (
      !isNonNegativeInteger(props.analyzedFileCount) ||
      props.analyzedFileCount > props.fileCount
    ) {
      return err(
        new InvalidProjectMetricsError(
          "analyzedFileCount must be an integer between 0 and fileCount.",
        ),
      );
    }

    if (!isUnitInterval(props.graphCoverage)) {
      return err(
        new InvalidProjectMetricsError(
          "graphCoverage must be a number in [0, 1].",
        ),
      );
    }

    if (!isNonNegativeInteger(props.findingsWithCrossFileEvidence)) {
      return err(
        new InvalidProjectMetricsError(
          "findingsWithCrossFileEvidence must be a non-negative integer.",
        ),
      );
    }

    if (
      !isNonNegativeInteger(props.totalFindings) ||
      props.findingsWithCrossFileEvidence > props.totalFindings
    ) {
      return err(
        new InvalidProjectMetricsError(
          "totalFindings must be an integer at or above findingsWithCrossFileEvidence.",
        ),
      );
    }

    if (!Number.isFinite(props.durationMs) || props.durationMs < 0) {
      return err(
        new InvalidProjectMetricsError(
          "durationMs must be a finite number at or above 0.",
        ),
      );
    }

    return ok(
      new ProjectMetrics(
        props.fileCount,
        props.analyzedFileCount,
        props.graphCoverage,
        props.findingsWithCrossFileEvidence,
        props.totalFindings,
        props.durationMs,
      ),
    );
  }

  /** Fraction of project files analyzed. */
  get fileCoverage(): number {
    return this.analyzedFileCount / this.fileCount;
  }

  /**
   * Fraction of findings backed by cross-file evidence. `1` when there are
   * no findings: with nothing to evidence, coverage is vacuously complete
   * rather than `NaN`.
   */
  get crossFileEvidenceCoverage(): number {
    if (this.totalFindings === 0) {
      return 1;
    }
    return this.findingsWithCrossFileEvidence / this.totalFindings;
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
