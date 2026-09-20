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
} from "../domain/dependency-signals.ts";
import { assessDip, type DipAssessment } from "../domain/dip-assessment.ts";
import { isSupportedLanguage } from "../domain/supported-language.ts";

/** Stable identifier. Matches `AnalysisResult.ruleId` (rule.port.ts). */
export const DIP_RULE_ID = "solid.dip";

const ANALYZER: AnalyzerMetadata = {
  name: "principled-solid-dip",
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
  "Reads imports and new-expressions with lightweight text scanning, not a full parser: re-exports through barrels, computed specifiers, template-literal imports, and injection frameworks can be missed or miscounted.",
  "Treats every infrastructure import as coupling; using an infrastructure module behind a narrow, owned abstraction is reported the same way as scattering it through high-level logic.",
  "Knows only the infrastructure modules in its fixed list; a new client library or an in-house wrapper named outside that list is invisible to this version.",
];

type Verdict = "violation" | "uncertain" | "compliant";

/**
 * Heuristic detector for Dependency Inversion Principle violations (#14):
 * flags a subject where high-level logic names infrastructure directly —
 * importing it or instantiating it — instead of depending on an
 * abstraction it owns.
 *
 * Deliberately not a claim about "correct" dependency style for every
 * language: a subject in a language this rule does not recognise is
 * reported `not_applicable`, never `compliant` or `violation`.
 */
export class DipRule implements Rule {
  readonly id = DIP_RULE_ID;

  async evaluate(subject: Subject): Promise<AnalysisResult> {
    if (!isSupportedLanguage(subject.language)) {
      return unwrap(
        AnalysisResult.of({
          ruleId: DIP_RULE_ID,
          status: "not_applicable",
          confidence: NOT_APPLICABLE_CONFIDENCE,
          method: "deterministic",
          evidence: [],
          explanation: `This rule does not yet know how to detect dependency signals in "${subject.language}".`,
          language: subject.language,
          analyzer: ANALYZER,
          humanReviewRecommended: false,
        }),
      );
    }

    return fromAssessment(subject, assessDip(subject.sourceCode));
  }
}

function fromAssessment(
  subject: Subject,
  assessment: DipAssessment,
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
      ruleId: DIP_RULE_ID,
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
  "Consider depending on an abstraction: inject the infrastructure behind a port your code owns so high-level logic never names a concrete client, pool, or broker.";

function toEvidence(signal: SignalLocation): Evidence {
  const location = unwrap(SourceLocation.of({ startLine: signal.startLine }));

  return unwrap(Evidence.of({ location, excerpt: signal.excerpt }));
}

function signalSummary(assessment: DipAssessment): string {
  const { infraImports, concreteInstantiations, total } = assessment.signals;

  return (
    `Found ${total} inversion signal(s): ` +
    `${infraImports} infrastructure import(s), ${concreteInstantiations} concrete instantiation(s).`
  );
}

function explanationFor(verdict: Verdict, assessment: DipAssessment): string {
  const summary = signalSummary(assessment);

  if (verdict === "violation") {
    return `Found dependency-inversion evidence in concrete couplings. ${summary}`;
  }

  if (verdict === "uncertain") {
    return `Could not confidently confirm or rule out a dependency-inversion violation. ${summary}`;
  }

  return `No dependency-inversion evidence in concrete couplings. ${summary}`;
}
