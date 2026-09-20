import type { AnalyzerMetadata } from "../../../analysis/domain/analyzer-metadata.ts";
import { AnalysisResult } from "../../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../../analysis/domain/confidence.ts";
import { Evidence } from "../../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../../analysis/domain/source-location.ts";
import type { Rule } from "../../../engine/application/rule.port.ts";
import type { Subject } from "../../../engine/domain/subject.ts";
import { unwrap } from "../../../shared/result.ts";
import {
  assessLsp,
  type LspAssessment,
  type RiskyOverride,
} from "../domain/lsp-assessment.ts";
import { isSupportedLanguage } from "../domain/supported-language.ts";

/** Stable identifier. Matches `AnalysisResult.ruleId` (rule.port.ts). */
export const LSP_RULE_ID = "solid.lsp";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-lsp",
  version: "1",
};

const NOT_APPLICABLE_CONFIDENCE = unwrap(Confidence.of(1));
const VIOLATION_CONFIDENCE = unwrap(Confidence.of(0.55));
const UNCERTAIN_CONFIDENCE = unwrap(Confidence.of(0.4));
const COMPLIANT_CONFIDENCE = unwrap(Confidence.of(0.65));

/**
 * Disclosed on every verdict this rule reaches about actual code (not on
 * `not_applicable`, which is a fact about scope, not a hedged judgment).
 */
const LIMITATIONS: readonly string[] = [
  "Finds class hierarchies and method bodies with lightweight text scanning, not a full parser: unusual formatting, class fields defined as arrow functions, and decorators with nested parentheses can be missed.",
  "Reads only an override that throws as substitutability risk; strengthened preconditions, weakened postconditions, and incompatible return values expressed without a throw are out of scope for this version.",
  "Compares only against parents defined in the same subject; a subclass of an external type cannot be judged and is reported uncertain, never compliant.",
];

/**
 * Heuristic detector for Liskov Substitution Principle violations (#12):
 * flags a subclass whose overrides throw where the locally-defined parent
 * did not — behaviour a caller written against the parent cannot expect.
 *
 * Deliberately not a claim about every form of substitutability: a subject
 * with no inheritance at all, or in a language this rule does not
 * recognise, is reported `not_applicable`, never `compliant`.
 */
export class LspRule implements Rule {
  readonly id = LSP_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    if (!isSupportedLanguage(subject.language)) {
      return notApplicable(
        subject,
        `This rule does not yet know how to detect inheritance in "${subject.language}".`,
      );
    }

    const assessment = assessLsp(subject.sourceCode);

    if (assessment.verdict === "not_applicable") {
      return notApplicable(
        subject,
        "No inheritance relationship was found to evaluate for substitutability.",
      );
    }

    return fromAssessment(subject, assessment);
  }
}

function notApplicable(subject: Subject, explanation: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: LSP_RULE_ID,
      status: "not_applicable",
      confidence: NOT_APPLICABLE_CONFIDENCE,
      method: "deterministic",
      evidence: [],
      explanation,
      language: subject.language,
      analyzer: ANALYZER,
      humanReviewRecommended: false,
    }),
  );
}

function fromAssessment(
  subject: Subject,
  assessment: LspAssessment,
): AnalysisResult {
  const verdict = assessment.verdict;
  const confidence =
    verdict === "violation"
      ? VIOLATION_CONFIDENCE
      : verdict === "uncertain"
        ? UNCERTAIN_CONFIDENCE
        : COMPLIANT_CONFIDENCE;

  return unwrap(
    AnalysisResult.of({
      ruleId: LSP_RULE_ID,
      status: verdict,
      confidence,
      method: "heuristic",
      evidence: assessment.riskyOverrides.map(toEvidence),
      explanation: explanationFor(assessment),
      ...(verdict === "violation" ? { remediation: REMEDIATION } : {}),
      language: subject.language,
      analyzer: ANALYZER,
      limitations: LIMITATIONS,
      humanReviewRecommended: verdict !== "compliant",
    }),
  );
}

const REMEDIATION =
  "Consider honouring the parent contract in the override instead of throwing, or narrowing the hierarchy so the subclass is not used where the parent is expected.";

function toEvidence(risk: RiskyOverride): Evidence {
  const { subclass } = risk;
  const location = unwrap(
    SourceLocation.of({
      startLine: subclass.startLine,
      endLine: subclass.endLine,
    }),
  );

  return unwrap(
    Evidence.of({
      location,
      excerpt: `${subclass.headerExcerpt} { … }`,
    }),
  );
}

function describeRisk(risk: RiskyOverride): string {
  return `"${risk.subclass.name}" overrides "${risk.methodName}" from "${risk.parentName}" and throws`;
}

function explanationFor(assessment: LspAssessment): string {
  if (assessment.reason === "unresolved_parent") {
    const details = assessment.unresolved
      .map(
        (item) =>
          `"${item.subclass.name}" extends "${item.parentName}" which is not defined in this subject`,
      )
      .join(". ");

    return `Could not resolve a parent class locally to compare substitutability. ${details}.`;
  }

  const details = assessment.riskyOverrides.map(describeRisk).join(". ");

  if (assessment.verdict === "violation") {
    return `Found substitutability evidence in overridden methods. ${details}.`;
  }

  if (assessment.verdict === "uncertain") {
    return `Could not confidently confirm or rule out a substitutability violation. ${details}.`;
  }

  return (
    "No subclass override introduced a new throw. " +
    `Checked ${assessment.resolvedSubclassCount} subclass(es) against their local parents.`
  );
}
