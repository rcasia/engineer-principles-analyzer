import type { AnalyzerMetadata } from "../../../analysis/domain/analyzer-metadata.ts";
import { AnalysisResult } from "../../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../../analysis/domain/confidence.ts";
import { Evidence } from "../../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../../analysis/domain/source-location.ts";
import type { Rule } from "../../../engine/application/rule.port.ts";
import type { Subject } from "../../../engine/domain/subject.ts";
import { unwrap } from "../../../shared/result.ts";
import {
  assessClass,
  type ClassAssessment,
} from "../domain/class-assessment.ts";
import { extractClasses } from "../domain/class-declaration.ts";
import { isSupportedLanguage } from "../domain/supported-language.ts";

/** Stable identifier. Matches `AnalysisResult.ruleId` (rule.port.ts). */
export const SRP_RULE_ID = "solid.srp";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-srp",
  version: "1",
};

const NOT_APPLICABLE_CONFIDENCE = unwrap(Confidence.of(1));
const VIOLATION_CONFIDENCE = unwrap(Confidence.of(0.55));
const UNCERTAIN_CONFIDENCE = unwrap(Confidence.of(0.4));
const COMPLIANT_CONFIDENCE = unwrap(Confidence.of(0.65));

/**
 * Disclosed on every verdict this rule reaches about actual code (not on
 * `not_applicable`, which is a fact about scope, not a hedged judgment) —
 * see ADR-0022 for why each of these is an accepted, not accidental, gap.
 */
const LIMITATIONS: readonly string[] = [
  "Finds class-shaped constructs and their top-level methods with lightweight text scanning, not a full parser: unusual formatting, class fields defined as arrow functions, and decorators with nested parentheses can be missed.",
  "Groups method names into responsibility domains using a fixed keyword dictionary; a method named outside that dictionary is not counted toward any domain, which can understate concentration.",
  "Evaluates cohesion by class only; a module of many unrelated top-level functions in a non-class style is out of scope for this version.",
];

type Verdict = "violation" | "uncertain" | "compliant";

/**
 * Heuristic detector for Single Responsibility Principle violations (#10):
 * flags a class whose top-level methods' names cluster into several
 * unrelated responsibility domains (persistence, communication,
 * presentation, ...).
 *
 * Deliberately not a claim about "correct" object-oriented design for
 * every language: a subject in a language this rule does not recognise as
 * class-based, or with no class construct at all, is reported
 * `not_applicable`, never `compliant` or `violation` (ADR-0022).
 */
export class SrpRule implements Rule {
  readonly id = SRP_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    if (!isSupportedLanguage(subject.language)) {
      return notApplicable(
        subject,
        `This rule does not yet know how to detect class-shaped constructs in "${subject.language}".`,
      );
    }

    const classes = extractClasses(subject.sourceCode);

    if (classes.length === 0) {
      return notApplicable(
        subject,
        "No class-like construct was found to evaluate for responsibility concentration.",
      );
    }

    return fromAssessments(subject, classes.map(assessClass));
  }
}

function notApplicable(subject: Subject, explanation: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: SRP_RULE_ID,
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

/**
 * One `AnalysisResult` per subject, not per class: the worst verdict among
 * the subject's classes wins (any `violation` outranks any `uncertain`,
 * which outranks `compliant`), and evidence is attached only for the
 * classes that produced that verdict — a compliant class in an otherwise
 * violating file is not evidence of the violation.
 */
function fromAssessments(
  subject: Subject,
  assessments: readonly ClassAssessment[],
): AnalysisResult {
  const violating = assessments.filter((a) => a.verdict === "violation");

  if (violating.length > 0) {
    return build(subject, "violation", VIOLATION_CONFIDENCE, violating);
  }

  const uncertain = assessments.filter((a) => a.verdict === "uncertain");

  if (uncertain.length > 0) {
    return build(subject, "uncertain", UNCERTAIN_CONFIDENCE, uncertain);
  }

  return build(subject, "compliant", COMPLIANT_CONFIDENCE, assessments);
}

function build(
  subject: Subject,
  verdict: Verdict,
  confidence: Confidence,
  highlighted: readonly ClassAssessment[],
): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: SRP_RULE_ID,
      status: verdict,
      confidence,
      method: "heuristic",
      evidence: highlighted.map(toEvidence),
      explanation: explanationFor(verdict, highlighted),
      ...(verdict === "violation"
        ? { remediation: remediationFor(highlighted) }
        : {}),
      language: subject.language,
      analyzer: ANALYZER,
      limitations: LIMITATIONS,
      humanReviewRecommended: verdict !== "compliant",
    }),
  );
}

function toEvidence(assessment: ClassAssessment): Evidence {
  const { declaration } = assessment;
  const location = unwrap(
    SourceLocation.of({
      startLine: declaration.startLine,
      endLine: declaration.endLine,
    }),
  );

  return unwrap(
    Evidence.of({
      location,
      excerpt: `${declaration.headerExcerpt} { … }`,
    }),
  );
}

function describe(assessment: ClassAssessment): string {
  const { declaration, methodCount, domains, reason } = assessment;

  if (reason === "too_few_methods") {
    return `"${declaration.name}" has only ${methodCount} method(s), too few to assess confidently`;
  }

  if (domains.length === 0) {
    return `"${declaration.name}"'s methods did not match more than one responsibility domain`;
  }

  const domainList = domains
    .map((domain) => `${domain.domain} (${domain.methodNames.join(", ")})`)
    .join("; ");

  return `"${declaration.name}" touches ${domains.length} responsibility domains: ${domainList}`;
}

function explanationFor(
  verdict: Verdict,
  assessments: readonly ClassAssessment[],
): string {
  const details = assessments.map(describe).join(". ");

  if (verdict === "violation") {
    return `Found method-name evidence of concentrated responsibility. ${details}.`;
  }

  if (verdict === "uncertain") {
    return `Could not confidently confirm or rule out a single-responsibility violation. ${details}.`;
  }

  return `No class showed method-name evidence of more than one responsibility domain. ${details}.`;
}

function remediationFor(assessments: readonly ClassAssessment[]): string {
  const suggestions = assessments.map((assessment) => {
    const domainNames = assessment.domains.map((domain) => domain.domain).join("/");

    return `extract ${domainNames} out of "${assessment.declaration.name}" into its own collaborator(s)`;
  });

  return `Consider splitting responsibilities: ${suggestions.join("; ")}.`;
}
