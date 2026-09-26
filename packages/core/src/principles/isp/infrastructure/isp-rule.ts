import type { AnalyzerMetadata } from "../../../analysis/domain/analyzer-metadata.ts";
import { AnalysisResult } from "../../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../../analysis/domain/confidence.ts";
import { Evidence } from "../../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../../analysis/domain/source-location.ts";
import type { Rule } from "../../../engine/application/rule.port.ts";
import { UNKNOWN_LANGUAGE, type Subject } from "../../../engine/domain/subject.ts";
import { unwrap } from "../../../shared/result.ts";
import type { InterfaceInfo } from "../domain/interface-declaration.ts";
import { assessIsp, type IspAssessment } from "../domain/isp-assessment.ts";
import { isSupportedLanguage } from "../domain/supported-language.ts";

/** Stable identifier. Matches `AnalysisResult.ruleId` (rule.port.ts). */
export const ISP_RULE_ID = "solid.isp";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-isp",
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
  "Finds interface and object-type members with lightweight text scanning, not a full parser: signatures broken across lines, conditional or mapped types, and unusual formatting can be miscounted.",
  "Reads member count as breadth; a large but cohesive set of related operations is reported the same way as unrelated operations forced on one client.",
  "Cannot see clients at all in a single subject: whether any consumer actually suffers the unused members is out of scope for this version.",
];

type Verdict = "violation" | "uncertain" | "compliant";

/**
 * Heuristic detector for Interface Segregation Principle violations (#13):
 * flags an interface (or object type) with more members than one consumer
 * plausibly needs, forcing clients to depend on operations they never use.
 *
 * Deliberately not a claim about "correct" interface size for every
 * language: a subject in a language this rule does not recognise, or with
 * no interface-shaped construct at all, is reported `not_applicable`,
 * never `compliant`.
 */
export class IspRule implements Rule {
  readonly id = ISP_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    if (
      !isSupportedLanguage(subject.language) &&
      subject.language.trim().toLowerCase() !== UNKNOWN_LANGUAGE
    ) {
      return notApplicable(
        subject,
        `This rule does not yet know how to detect interfaces in "${subject.language}".`,
      );
    }

    const assessment = assessIsp(subject.sourceCode);

    if (assessment.verdict === "not_applicable") {
      return notApplicable(
        subject,
        "No interface- or object-type construct was found to evaluate for interface segregation.",
      );
    }

    return fromAssessment(subject, assessment);
  }
}

function notApplicable(subject: Subject, explanation: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: ISP_RULE_ID,
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
  assessment: IspAssessment,
): AnalysisResult {
  const verdict = assessment.verdict as Verdict;
  const confidence =
    verdict === "violation"
      ? VIOLATION_CONFIDENCE
      : verdict === "uncertain"
        ? UNCERTAIN_CONFIDENCE
        : COMPLIANT_CONFIDENCE;

  return unwrap(
    AnalysisResult.of({
      ruleId: ISP_RULE_ID,
      status: verdict,
      confidence,
      method: "heuristic",
      evidence: assessment.highlighted.map(toEvidence),
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
  "Consider splitting the broad interface: group related operations behind consumer-specific interfaces so clients depend only on what they use.";

function toEvidence(info: InterfaceInfo): Evidence {
  const location = unwrap(
    SourceLocation.of({ startLine: info.startLine, endLine: info.endLine }),
  );

  return unwrap(
    Evidence.of({ location, excerpt: `${info.headerExcerpt} { … }` }),
  );
}

function describeInterface(info: InterfaceInfo): string {
  return `"${info.name}" exposes ${info.memberCount} member(s)`;
}

function explanationFor(assessment: IspAssessment): string {
  const details = assessment.highlighted.map(describeInterface).join(". ");

  if (assessment.verdict === "violation") {
    return `Found interface-segregation evidence in broad interfaces. ${details}.`;
  }

  if (assessment.verdict === "uncertain") {
    return `Could not confidently confirm or rule out an interface-segregation violation. ${details}.`;
  }

  // The broadest count without optional chaining: a compliant verdict implies
  // a non-empty interface list (an empty one is not_applicable), but spelling
  // the fallback as `?.`/`??` leaves an equivalent, untestable mutant behind,
  // so the zero floor is expressed as a Math.max floor instead.
  const broadestCount = Math.max(
    ...assessment.interfaces.map((info) => info.memberCount),
    0,
  );

  return (
    "No interface showed evidence of unrelated-operation grouping. " +
    `Checked ${assessment.interfaces.length} interface(s); the broadest exposes ${broadestCount} member(s).`
  );
}
