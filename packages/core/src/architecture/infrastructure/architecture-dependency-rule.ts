import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import type { Rule } from "../../engine/application/rule.port.ts";
import type { Subject } from "../../engine/domain/subject.ts";
import { unwrap } from "../../shared/result.ts";

/** Stable identifier of the single-file architecture rule. */
export const ARCHITECTURE_DEPENDENCY_RULE_ID = "architecture.dependency";

/**
 * The architecture dependency rule as a single-file `Rule` (#23 "for
 * single-file web analysis, only emit findings that are observable from the
 * submitted file", #39 "single-file web analysis does not pretend to
 * provide cross-file dependency conclusions").
 *
 * A single file carries no observable dependency edges, so this rule always
 * reports `not_applicable` with the project-scope limitation spelled out.
 * Real dependency conclusions come from `EvaluateArchitecture` at project
 * scope; this adapter exists so single-file runs (CLI, web) name the gap
 * explicitly instead of silently skipping it or, worse, inventing one.
 */
export class ArchitectureDependencyRule implements Rule {
  readonly id = ARCHITECTURE_DEPENDENCY_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    return unwrap(
      AnalysisResult.of({
        ruleId: this.id,
        status: "not_applicable",
        confidence: unwrap(Confidence.of(1)),
        method: "heuristic",
        evidence: [],
        explanation:
          "Cross-file dependency rules require project scope with a dependency graph; a single file provides no observable dependency edges.",
        language: subject.language,
        analyzer: { name: "principled-architecture", version: "1" },
        limitations: [
          "Single-file analysis cannot observe cross-file dependencies; run project-level analysis for dependency conclusions.",
        ],
        humanReviewRecommended: false,
      }),
    );
  }
}
