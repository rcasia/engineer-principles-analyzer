import type { AnalyzerMetadata } from "../../../analysis/domain/analyzer-metadata.ts";
import type { AnalysisStatus } from "../../../analysis/domain/analysis-status.ts";
import { AnalysisResult } from "../../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../../analysis/domain/confidence.ts";
import { Evidence } from "../../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../../analysis/domain/source-location.ts";
import type { Rule } from "../../../engine/application/rule.port.ts";
import type { Subject } from "../../../engine/domain/subject.ts";
import type { JevClient } from "../../../jev/application/jev-client.port.ts";
import { excerptForEvidence } from "../../../jev/domain/evidence-excerpt.ts";
import { toNoulVerdict } from "../../../jev/domain/noul-verdict.ts";
import { unwrap } from "../../../shared/result.ts";

/**
 * Stable identifier. Deliberately distinct from `solid.srp`: this is the
 * Jev-backed probe, not the method-name heuristic, so evaluation snapshots
 * (#30) can attribute each verdict to the exact implementation behind it.
 */
export const JEV_SRP_RULE_ID = "solid.srp.jev";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-srp-jev",
  version: "1",
};

const QUESTION_INSTRUCTIONS =
  "Does this source code concentrate multiple unrelated responsibilities in one place, in violation of the Single Responsibility Principle?";

const QUESTION_CRITERIA: { readonly true: string; readonly false: string } = {
  true: "One class or module does work from two or more of these areas: persistence, communication, presentation, validation, calculation, authentication, serialization, logging.",
  false: "Every class or module has a single coherent responsibility.",
};

/**
 * Disclosed on every verdict: an AI probability is not a located finding,
 * the cutoffs are unevaluated defaults, and repeat runs can disagree — the
 * compliance baseline's (#28) "never present AI findings as deterministic
 * facts", as mandatory fields rather than documentation.
 */
const LIMITATIONS: readonly string[] = [
  "Jev returns a single calibrated probability with no source locations: violation evidence points at the subject's first non-empty line, not at the offending code.",
  "The violation/compliant cutoffs (0.75/0.25) are starting defaults, not measured thresholds: tune them against the versioned corpus (#27) before trusting the boundary.",
  "AI judgments are non-deterministic: the same subject can receive different verdicts across runs or model versions. evaluationMetadata.jevModel records which model answered.",
];

const GENERIC_REMEDIATION =
  "Consider splitting responsibilities: name each distinct responsibility in the subject, then extract each one into its own collaborator, one at a time.";

/**
 * Hedged counterpart of {@link GENERIC_REMEDIATION} for `uncertain`
 * verdicts (#21, #37): the suggestion must preserve the model's own
 * uncertainty rather than directing a split — review first, extract only
 * what the review confirms.
 */
const UNCERTAIN_REMEDIATION =
  "Consider whether the subject mixes more than one responsibility; if a review confirms they are truly distinct, extract each one into its own collaborator, one at a time.";

/**
 * AI-assisted probe for Single Responsibility violations (#10), built to
 * validate the core engine and result contract against an external judgment
 * source (ADR-0024) — the deferred Option 3 of ADR-0022, scoped to
 * validation rather than production use.
 *
 * One Noul question per subject ("whether a condition holds", per the
 * TypeSafe skill's primitive guidance) over the state `{ sourceCode,
 * language }` — the only two fields a rule may ever see. Transport and wire
 * failures throw and become the engine's `unable_to_analyze`, never a fake
 * verdict. Every verdict reports `ai_assisted` and recommends human review,
 * including `compliant`: a model's silence is not permission to act.
 */
export class JevSrpRule implements Rule {
  readonly id = JEV_SRP_RULE_ID;
  private readonly client: JevClient;

  constructor(client: JevClient) {
    this.client = client;
  }

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    const judgment = await this.client.evaluateNoul({
      state: { sourceCode: subject.sourceCode, language: subject.language },
      question: {
        instructions: QUESTION_INSTRUCTIONS,
        criteria: { ...QUESTION_CRITERIA },
      },
    });
    const verdict = unwrap(toNoulVerdict(judgment.value));
    const confidence = unwrap(Confidence.of(verdict.confidence));

    if (verdict.status === "violation") {
      const excerpt = excerptForEvidence(subject.sourceCode);
      const location = unwrap(
        SourceLocation.of({ startLine: excerpt.lineNumber }),
      );
      const evidence = unwrap(
        Evidence.of({ location, excerpt: excerpt.text }),
      );

      return build(
        subject,
        "violation",
        confidence,
        [evidence],
        `Jev judged this subject likely to violate the Single Responsibility Principle (noul=${judgment.value}). The model found evidence of concentrated responsibility.`,
        judgment.model,
      );
    }

    if (verdict.status === "uncertain") {
      return build(
        subject,
        "uncertain",
        confidence,
        [],
        `Jev could not confidently confirm or rule out a single-responsibility violation (noul=${judgment.value}). The model's probability fell between the violation and compliant cutoffs.`,
        judgment.model,
      );
    }

    return build(
      subject,
      "compliant",
      confidence,
      [],
      `Jev found no sign of a single-responsibility violation (noul=${judgment.value}). The model judged each class or module to have a single coherent responsibility.`,
      judgment.model,
    );
  }
}

function build(
  subject: Subject,
  status: Extract<AnalysisStatus, "violation" | "uncertain" | "compliant">,
  confidence: Confidence,
  evidence: readonly Evidence[],
  explanation: string,
  jevModel: string,
): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: JEV_SRP_RULE_ID,
      status,
      confidence,
      method: "ai_assisted",
      evidence,
      explanation,
      ...(status === "violation" ? { remediation: GENERIC_REMEDIATION } : {}),
      ...(status === "uncertain" ? { remediation: UNCERTAIN_REMEDIATION } : {}),
      language: subject.language,
      analyzer: ANALYZER,
      limitations: LIMITATIONS,
      humanReviewRecommended: true,
      evaluationMetadata: { jevModel },
    }),
  );
}
