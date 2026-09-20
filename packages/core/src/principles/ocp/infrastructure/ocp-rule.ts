import type { AnalyzerMetadata } from "../../../analysis/domain/analyzer-metadata.ts";
import { AnalysisResult } from "../../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../../analysis/domain/confidence.ts";
import { Evidence } from "../../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../../analysis/domain/source-location.ts";
import type { Rule } from "../../../engine/application/rule.port.ts";
import type { Subject } from "../../../engine/domain/subject.ts";
import { unwrap } from "../../../shared/result.ts";
import {
  locateFirstSignal,
  type SignalLocation,
} from "../domain/branch-signals.ts";
import { assessOcp, type OcpAssessment } from "../domain/ocp-assessment.ts";
import { isSupportedLanguage } from "../domain/supported-language.ts";

/** Stable identifier. Matches `AnalysisResult.ruleId` (rule.port.ts). */
export const OCP_RULE_ID = "solid.ocp";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-ocp",
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
  "Counts switch statements, else-if chains, and typeof/instanceof type guards with lightweight text scanning, not a full parser: branches hidden in strings, templates, or comments are ignored, but unusual formatting can still miscount.",
  "Treats every branch as extension pressure; a genuinely closed set of cases (days of the week, an exhaustive state machine) is reported the same way as a type-dispatch chain that should have been polymorphism.",
  "Cannot see extension points it does not look for: polymorphism, composition, registries, or plugin hooks already in place are out of scope for this version.",
];

type Verdict = "violation" | "uncertain" | "compliant";

/**
 * Heuristic detector for Open/Closed Principle violations (#11): flags a
 * subject whose extension pressure — switch statements, else-if chains and
 * type-based dispatch — suggests new behaviour arrives by editing existing
 * branches instead of adding new code.
 *
 * Deliberately not a claim about "correct" extension style for every
 * language: a subject in a language this rule does not recognise is
 * reported `not_applicable`, never `compliant` or `violation`.
 */
export class OcpRule implements Rule {
  readonly id = OCP_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    if (!isSupportedLanguage(subject.language)) {
      return unwrap(
        AnalysisResult.of({
          ruleId: OCP_RULE_ID,
          status: "not_applicable",
          confidence: NOT_APPLICABLE_CONFIDENCE,
          method: "deterministic",
          evidence: [],
          explanation: `This rule does not yet know how to detect extension signals in "${subject.language}".`,
          language: subject.language,
          analyzer: ANALYZER,
          humanReviewRecommended: false,
        }),
      );
    }

    return fromAssessment(subject, assessOcp(subject.sourceCode));
  }
}

function fromAssessment(
  subject: Subject,
  assessment: OcpAssessment,
): AnalysisResult {
  const { signals, verdict } = assessment;
  const confidence =
    verdict === "violation"
      ? VIOLATION_CONFIDENCE
      : verdict === "uncertain"
        ? UNCERTAIN_CONFIDENCE
        : COMPLIANT_CONFIDENCE;
  const firstSignal: SignalLocation | undefined =
    signals.total > 0 ? locateFirstSignal(subject.sourceCode) : undefined;

  return unwrap(
    AnalysisResult.of({
      ruleId: OCP_RULE_ID,
      status: verdict,
      confidence,
      method: "heuristic",
      evidence: firstSignal === undefined ? [] : [toEvidence(firstSignal)],
      explanation: explanationFor(verdict, assessment),
      ...(verdict === "violation" ? { remediation: REMEDIATION } : {}),
      language: subject.language,
      analyzer: ANALYZER,
      limitations: LIMITATIONS,
      humanReviewRecommended: verdict !== "compliant",
    }),
  );
}

const REMEDIATION =
  "Consider opening the branched logic for extension: replace type-based dispatch with polymorphism or a handler registry so new cases add code instead of editing existing branches.";

function toEvidence(signal: SignalLocation): Evidence {
  const location = unwrap(SourceLocation.of({ startLine: signal.startLine }));

  return unwrap(Evidence.of({ location, excerpt: signal.excerpt }));
}

function signalSummary(assessment: OcpAssessment): string {
  const { switches, elseIfs, typeGuards, total } = assessment.signals;

  return (
    `Found ${total} extension signal(s): ` +
    `${switches} switch statement(s), ${elseIfs} else-if(s), ${typeGuards} type guard(s).`
  );
}

function explanationFor(verdict: Verdict, assessment: OcpAssessment): string {
  const summary = signalSummary(assessment);

  if (verdict === "violation") {
    return `Found branching evidence of extension by modification. ${summary}`;
  }

  if (verdict === "uncertain") {
    return `Could not confidently confirm or rule out an open/closed violation. ${summary}`;
  }

  return `No branching evidence of extension by modification. ${summary}`;
}
