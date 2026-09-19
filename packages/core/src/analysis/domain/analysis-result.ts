import { err, ok, type Result } from "../../shared/result.ts";
import { isAnalysisMethod, type AnalysisMethod } from "./analysis-method.ts";
import { isAnalysisStatus, type AnalysisStatus } from "./analysis-status.ts";
import type { AnalyzerMetadata } from "./analyzer-metadata.ts";
import { Confidence, MAXIMUM_CONFIDENCE } from "./confidence.ts";
import type { Evidence } from "./evidence.ts";

export class InvalidAnalysisResultError extends Error {
  override readonly name = "InvalidAnalysisResultError";
}

export interface AnalysisResultProps {
  /** Which rule produced this result, e.g. `"solid.srp"`. */
  readonly ruleId: string;
  readonly status: AnalysisStatus;
  readonly confidence: Confidence;
  readonly method: AnalysisMethod;
  /** Empty for statuses that need nothing to point at. */
  readonly evidence: readonly Evidence[];
  /** Human-readable rationale for the status. */
  readonly explanation: string;
  /** Suggested fix. Optional: not every status has one to give. */
  readonly remediation?: string;
  /** The language the subject was analyzed as, e.g. `"typescript"`. */
  readonly language: string;
  readonly analyzer: AnalyzerMetadata;
  /** Known weaknesses of this specific result, e.g. limited context. */
  readonly limitations?: readonly string[];
  /**
   * Whether a person should confirm this result before it is acted on.
   * Required, not inferred, because only the analyzer that produced the
   * result knows why it might be wrong in ways confidence alone does not
   * capture (see the compliance baseline, #28).
   */
  readonly humanReviewRecommended: boolean;
  /**
   * Free-form metadata tying this result to a versioned evaluation
   * snapshot (#30) — e.g. corpus id, evaluation run id. Never a place for
   * user-tracking or product-analytics fields.
   */
  readonly evaluationMetadata?: Readonly<Record<string, string>>;
}

/**
 * The stable, machine-readable outcome of evaluating one rule against one
 * subject — the contract both the CLI and the web UI render, and the only
 * shape a rule implementation is allowed to return (#9).
 *
 * Immutable value object: the only way to obtain one is
 * {@link AnalysisResult.of}, which returns a {@link Result} rather than
 * throwing — a rule implementation passing a bad combination of fields is
 * an expected outcome of validating untrusted input, not an exceptional
 * condition. It enforces the invariants that keep a probabilistic finding
 * from ever being mistaken for a deterministic one:
 *
 * - A `deterministic` method must report maximum confidence: a fixed
 *   procedure that is not sure of its own answer is a contradiction, not a
 *   nuance.
 * - A `violation` must carry at least one piece of evidence: an accusation
 *   with nothing to point at is not a finding.
 * - An `uncertain` status must recommend human review: the one party who
 *   should never be more confident than the analyzer itself is the caller
 *   reading its output.
 */
export class AnalysisResult {
  readonly ruleId: string;
  readonly status: AnalysisStatus;
  readonly confidence: Confidence;
  readonly method: AnalysisMethod;
  readonly evidence: readonly Evidence[];
  readonly explanation: string;
  readonly remediation: string | undefined;
  readonly language: string;
  readonly analyzer: AnalyzerMetadata;
  readonly limitations: readonly string[];
  readonly humanReviewRecommended: boolean;
  readonly evaluationMetadata: Readonly<Record<string, string>> | undefined;

  private constructor(props: {
    ruleId: string;
    status: AnalysisStatus;
    confidence: Confidence;
    method: AnalysisMethod;
    evidence: readonly Evidence[];
    explanation: string;
    remediation: string | undefined;
    language: string;
    analyzer: AnalyzerMetadata;
    limitations: readonly string[];
    humanReviewRecommended: boolean;
    evaluationMetadata: Readonly<Record<string, string>> | undefined;
  }) {
    this.ruleId = props.ruleId;
    this.status = props.status;
    this.confidence = props.confidence;
    this.method = props.method;
    this.evidence = props.evidence;
    this.explanation = props.explanation;
    this.remediation = props.remediation;
    this.language = props.language;
    this.analyzer = props.analyzer;
    this.limitations = props.limitations;
    this.humanReviewRecommended = props.humanReviewRecommended;
    this.evaluationMetadata = props.evaluationMetadata;
  }

  static of(
    props: AnalysisResultProps,
  ): Result<AnalysisResult, InvalidAnalysisResultError> {
    const {
      ruleId,
      status,
      confidence,
      method,
      evidence,
      explanation,
      remediation,
      language,
      analyzer,
      limitations,
      humanReviewRecommended,
      evaluationMetadata,
    } = props;

    if (ruleId.trim().length === 0) {
      return err(new InvalidAnalysisResultError("ruleId must not be empty."));
    }

    if (!isAnalysisStatus(status)) {
      return err(
        new InvalidAnalysisResultError(
          `status must be a known AnalysisStatus, got "${status}".`,
        ),
      );
    }

    if (!isAnalysisMethod(method)) {
      return err(
        new InvalidAnalysisResultError(
          `method must be a known AnalysisMethod, got "${method}".`,
        ),
      );
    }

    if (explanation.trim().length === 0) {
      return err(
        new InvalidAnalysisResultError("explanation must not be empty."),
      );
    }

    if (language.trim().length === 0) {
      return err(
        new InvalidAnalysisResultError("language must not be empty."),
      );
    }

    if (analyzer.name.trim().length === 0) {
      return err(
        new InvalidAnalysisResultError("analyzer.name must not be empty."),
      );
    }

    if (analyzer.version.trim().length === 0) {
      return err(
        new InvalidAnalysisResultError(
          "analyzer.version must not be empty.",
        ),
      );
    }

    if (method === "deterministic" && confidence.value !== MAXIMUM_CONFIDENCE) {
      return err(
        new InvalidAnalysisResultError(
          "A deterministic result must report maximum confidence.",
        ),
      );
    }

    if (status === "violation" && evidence.length === 0) {
      return err(
        new InvalidAnalysisResultError(
          "A violation must be backed by at least one piece of evidence.",
        ),
      );
    }

    if (status === "uncertain" && !humanReviewRecommended) {
      return err(
        new InvalidAnalysisResultError(
          "An uncertain result must recommend human review.",
        ),
      );
    }

    return ok(
      new AnalysisResult({
        ruleId,
        status,
        confidence,
        method,
        evidence: [...evidence],
        explanation,
        remediation,
        language,
        analyzer,
        limitations: limitations ? [...limitations] : [],
        humanReviewRecommended,
        evaluationMetadata: evaluationMetadata
          ? { ...evaluationMetadata }
          : undefined,
      }),
    );
  }
}
