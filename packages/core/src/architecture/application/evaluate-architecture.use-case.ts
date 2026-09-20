import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { AnalyzerMetadata } from "../../analysis/domain/analyzer-metadata.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import { unwrap } from "../../shared/result.ts";
import {
  type ArchitectureConstraint,
} from "../domain/architecture-constraint.ts";
import {
  architectureGraphCoverage,
  type ArchitectureEdge,
  type ArchitectureViolation,
  evaluateArchitecture,
} from "../domain/architecture-evaluation.ts";

export class InvalidArchitectureEvaluationError extends Error {
  override readonly name = "InvalidArchitectureEvaluationError";
}

const ARCHITECTURE_ANALYZER: AnalyzerMetadata = {
  name: "principled-architecture",
  version: "1",
};

export interface ArchitectureEvaluationRequest {
  /** Every file the run knows about. */
  readonly nodes: readonly string[];
  /** The observed dependency edges. */
  readonly edges: readonly ArchitectureEdge[];
  readonly constraints: readonly ArchitectureConstraint[];
  /** Language label carried into each result, e.g. `"project"`. */
  readonly language: string;
  /**
   * Minimum graph coverage required to conclude a constraint is satisfied.
   * Defaults to `1`: without full coverage, absence of a violation is
   * reported as `uncertain`, never as `compliant` (#39 "not inferred
   * without sufficient graph coverage"). Must be in (0, 1].
   */
  readonly minimumCoverage?: number;
}

export interface ArchitectureEvaluation {
  /** One result per constraint, in constraint order. */
  readonly results: readonly AnalysisResult[];
  readonly violations: readonly ArchitectureViolation[];
  readonly graphCoverage: number;
}

/**
 * Evaluates architecture dependency constraints against an observed
 * dependency graph (#23, #39).
 *
 * Pure orchestration over the shared `AnalysisResult` contract — the
 * evaluation logic itself lives in `domain/architecture-evaluation.ts`,
 * so project-level callers (`AnalyzeProject` via a `ProjectRule` adapter)
 * reuse it instead of reimplementing it. Uncertainty is explicit: found
 * violations are reported whatever the coverage, but compliance is only
 * concluded when coverage reaches `minimumCoverage`; anything less is
 * `uncertain` with human review recommended (#23 "confidence calibration",
 * "graph/dependency coverage").
 */
export class EvaluateArchitecture {
  execute(request: ArchitectureEvaluationRequest): ArchitectureEvaluation {
    const minimumCoverage = request.minimumCoverage ?? 1;
    if (
      !Number.isFinite(minimumCoverage) ||
      minimumCoverage <= 0 ||
      minimumCoverage > 1
    ) {
      throw new InvalidArchitectureEvaluationError(
        "minimumCoverage must be a number in (0, 1].",
      );
    }

    const coverage = architectureGraphCoverage(request.nodes, request.edges);
    const violations = evaluateArchitecture(request.edges, request.constraints);
    const results = request.constraints.map((constraint) =>
      resultFor(constraint, violations, coverage, minimumCoverage, request.language),
    );

    return { results, violations, graphCoverage: coverage };
  }
}

function resultFor(
  constraint: ArchitectureConstraint,
  violations: readonly ArchitectureViolation[],
  coverage: number,
  minimumCoverage: number,
  language: string,
): AnalysisResult {
  const own = violations.filter(
    (violation) => violation.constraintId === constraint.id,
  );
  const ruleId = `architecture.${constraint.id}`;
  const coverageNote =
    coverage < 1
      ? `Graph coverage is ${coverage}: conclusions cover only observed edges.`
      : undefined;

  if (own.length > 0) {
    return unwrap(
      AnalysisResult.of({
        ruleId,
        status: "violation",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: own.map((violation) => violationEvidence(violation)),
        explanation: `${own.length} dependency path(s) violate constraint "${constraint.id}".`,
        language,
        analyzer: ARCHITECTURE_ANALYZER,
        limitations: coverageNote === undefined ? [] : [coverageNote],
        humanReviewRecommended: false,
      }),
    );
  }

  if (coverage >= minimumCoverage) {
    return unwrap(
      AnalysisResult.of({
        ruleId,
        status: "compliant",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [],
        explanation: `No dependency violates constraint "${constraint.id}" at graph coverage ${coverage}.`,
        language,
        analyzer: ARCHITECTURE_ANALYZER,
        limitations: coverageNote === undefined ? [] : [coverageNote],
        humanReviewRecommended: false,
      }),
    );
  }

  return unwrap(
    AnalysisResult.of({
      ruleId,
      status: "uncertain",
      confidence: unwrap(Confidence.of(0.5)),
      method: "heuristic",
      evidence: [],
      explanation: `Cannot decide constraint "${constraint.id}": graph coverage ${coverage} is below the required ${minimumCoverage}.`,
      language,
      analyzer: ARCHITECTURE_ANALYZER,
      limitations: [
        `Graph coverage is ${coverage}, below the required ${minimumCoverage}; unobserved edges may hide violations.`,
        "Re-run with fuller graph coverage before treating this constraint as satisfied.",
      ],
      humanReviewRecommended: true,
    }),
  );
}

/**
 * Evidence for one violation: the offending path as a metadata string plus
 * the source file it starts from. The excerpt names files, never quotes
 * them — dependency structure is a fact about the project, not its content.
 */
function violationEvidence(violation: ArchitectureViolation): Evidence {
  return unwrap(
    Evidence.of({
      location: unwrap(
        SourceLocation.of({ filePath: violation.from, startLine: 1 }),
      ),
      excerpt: `dependency path: ${violation.path.join(" -> ")}`,
    }),
  );
}
