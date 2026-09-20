import { AnalyzeSubject } from "../../engine/application/analyze-subject.use-case.ts";
import { Subject } from "../../engine/domain/subject.ts";
import type { AnalysisStatus } from "../../analysis/domain/analysis-status.ts";
import type { RuleLanguageQuality } from "../domain/evaluation-snapshot.ts";
import { summarizeRuleQuality } from "../domain/rule-quality.ts";
import type { CorpusEntry } from "../domain/corpus-entry.ts";
import { unwrap } from "../../shared/result.ts";

export interface EvaluateCorpusRequest {
  readonly entries: readonly CorpusEntry[];
}

export interface EvaluateCorpusResult {
  /** One quality row per (ruleId, language) group, in first-seen order. */
  readonly qualities: readonly RuleLanguageQuality[];
}

interface Judgment {
  readonly entry: CorpusEntry;
  readonly actual: AnalysisStatus;
  readonly confidence: number;
  readonly evidenceCount: number;
}

/**
 * Runs a corpus through the real rule evaluation engine (#9) and
 * summarizes what happened per rule and language, reusing the shared
 * confusion-count machinery (#30) instead of inventing a second one.
 *
 * Binary framing: an expected `violation` the rule does not report as a
 * `violation` is a false negative, and an expected `compliant` the rule
 * does not report as `compliant` is a false positive — an honest
 * `uncertain` on a corpus fixture still misses the pinned expectation,
 * because a fixture the rules cannot decide is a bad fixture, not a
 * passing test.
 *
 * Corpus entries are code, not user input: an entry that fails `Subject`
 * validation is a programmer bug, so it throws rather than returning a
 * validation value.
 */
export class EvaluateCorpus {
  constructor(private readonly analyzeSubject: AnalyzeSubject) {}

  async execute(
    request: EvaluateCorpusRequest,
  ): Promise<EvaluateCorpusResult> {
    const judgments: Judgment[] = [];

    for (const entry of request.entries) {
      const subject = unwrap(
        Subject.of({ sourceCode: entry.sourceCode, language: entry.language }),
      );
      const run = await this.analyzeSubject.execute({
        subject,
        ruleIds: [entry.ruleId],
      });
      const [result] = run.results;

      if (result === undefined) {
        throw new Error(
          `EvaluateCorpus: engine returned no result for rule "${entry.ruleId}".`,
        );
      }

      judgments.push({
        entry,
        actual: result.status,
        confidence: result.confidence.value,
        evidenceCount: result.evidence.length,
      });
    }

    return { qualities: summarizeByRule(judgments) };
  }
}

function summarizeByRule(
  judgments: readonly Judgment[],
): readonly RuleLanguageQuality[] {
  const groups = new Map<
    string,
    { ruleId: string; language: string; judgments: Judgment[] }
  >();

  for (const judgment of judgments) {
    const key = JSON.stringify([judgment.entry.ruleId, judgment.entry.language]);
    const group = groups.get(key) ?? {
      ruleId: judgment.entry.ruleId,
      language: judgment.entry.language,
      judgments: [],
    };
    group.judgments.push(judgment);
    groups.set(key, group);
  }

  return [...groups.values()].map(({ ruleId, language, judgments }) => {
    const group = judgments;
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let confidenceSum = 0;
    let withEvidence = 0;

    for (const judgment of group) {
      if (judgment.entry.expected === "violation") {
        if (judgment.actual === "violation") {
          truePositives += 1;
        } else {
          falseNegatives += 1;
        }
      } else if (judgment.actual === "compliant") {
        trueNegatives += 1;
      } else {
        falsePositives += 1;
      }

      confidenceSum += judgment.confidence;

      if (judgment.evidenceCount > 0) {
        withEvidence += 1;
      }
    }

    const quality = summarizeRuleQuality({
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
    });
    const meanConfidence = confidenceSum / group.length;

    return {
      ruleId,
      language,
      precision: quality.precision,
      recall: quality.recall,
      falsePositiveRate: quality.falsePositiveRate,
      falseNegativeRate: quality.falseNegativeRate,
      meanConfidence,
      calibrationGap:
        quality.precision === null
          ? null
          : Math.abs(meanConfidence - quality.precision),
      evidenceCoverage: withEvidence / group.length,
      sampleSize: group.length,
    };
  });
}
