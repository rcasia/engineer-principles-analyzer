import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { AnalysisStatus } from "../../analysis/domain/analysis-status.ts";
import type { Subject } from "../../engine/domain/subject.ts";
import type { VersionedRule } from "./versioned-rule.port.ts";

export interface RuleFixture {
  /** Human name shown in reports, e.g. `"flags console.log"`. */
  readonly name: string;
  readonly subject: Subject;
  readonly expectedStatus: AnalysisStatus;
}

export interface FixtureOutcome {
  readonly name: string;
  readonly expected: AnalysisStatus;
  /** `"unable_to_analyze"` when the rule threw or broke the contract. */
  readonly actual: AnalysisStatus | "unable_to_analyze";
  readonly match: boolean;
}

export interface FixtureEvaluation {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly passed: boolean;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly outcomes: readonly FixtureOutcome[];
}

export interface FixtureEvaluationRequest {
  readonly rule: VersionedRule;
  readonly fixtures: readonly RuleFixture[];
}

/**
 * Tests a custom rule against evaluation fixtures (#40 "custom rules can
 * be tested against evaluation fixtures"): runs the rule over each
 * fixture subject and compares the verdict with the expected status.
 * A rule that throws or breaks the result contract fails its fixture —
 * isolation is the caller's job, honesty about the outcome is this
 * use-case's.
 */
export class TestCustomRule {
  async execute(request: FixtureEvaluationRequest): Promise<FixtureEvaluation> {
    const outcomes: FixtureOutcome[] = [];
    for (const fixture of request.fixtures) {
      outcomes.push(await this.check(request.rule, fixture));
    }

    const passedCount = outcomes.filter((outcome) => outcome.match).length;
    return {
      ruleId: request.rule.id,
      ruleVersion: request.rule.version,
      passed: passedCount === outcomes.length,
      passedCount,
      totalCount: outcomes.length,
      outcomes,
    };
  }

  private async check(
    rule: VersionedRule,
    fixture: RuleFixture,
  ): Promise<FixtureOutcome> {
    // No default: every path below assigns, so the `catch` assignment is
    // load-bearing — a rule that throws must read back as unable_to_analyze.
    let actual: AnalysisStatus | "unable_to_analyze";
    try {
      const outcome = await rule.evaluate(fixture.subject);
      actual =
        outcome instanceof AnalysisResult ? outcome.status : "unable_to_analyze";
    } catch {
      actual = "unable_to_analyze";
    }

    return {
      name: fixture.name,
      expected: fixture.expectedStatus,
      actual,
      match: actual === fixture.expectedStatus,
    };
  }
}
