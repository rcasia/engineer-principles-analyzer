import type { AnalysisResult } from "@principled/core";

export interface PlainLocation {
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn?: number | undefined;
  readonly filePath?: string | undefined;
}

export interface PlainEvidence {
  readonly location: PlainLocation;
  readonly excerpt: string;
}

export interface PlainResult {
  readonly ruleId: string;
  readonly status: string;
  readonly confidence: number;
  readonly method: string;
  readonly evidence: readonly PlainEvidence[];
  readonly explanation: string;
  readonly remediation?: string | undefined;
  readonly language: string;
  readonly analyzer: { readonly name: string; readonly version: string };
  readonly limitations: readonly string[];
  readonly humanReviewRecommended: boolean;
  readonly evaluationMetadata?: Readonly<Record<string, string>> | undefined;
}

/**
 * Plain-data view of one `AnalysisResult` for JSON and SARIF output.
 * The domain object itself is a class instance; this keeps the wire shape
 * explicit, JSON-safe, and free of methods — and free of the submitted
 * source, which never belongs in machine-readable output (#28).
 */
export function toPlainResult(result: AnalysisResult): PlainResult {
  return {
    ruleId: result.ruleId,
    status: result.status,
    confidence: result.confidence.value,
    method: result.method,
    evidence: result.evidence.map((item) => ({
      location: {
        startLine: item.location.startLine,
        endLine: item.location.endLine,
        ...(item.location.startColumn === undefined
          ? {}
          : { startColumn: item.location.startColumn }),
        ...(item.location.filePath === undefined
          ? {}
          : { filePath: item.location.filePath }),
      },
      excerpt: item.excerpt,
    })),
    explanation: result.explanation,
    ...(result.remediation === undefined
      ? {}
      : { remediation: result.remediation }),
    language: result.language,
    analyzer: {
      name: result.analyzer.name,
      version: result.analyzer.version,
    },
    limitations: [...result.limitations],
    humanReviewRecommended: result.humanReviewRecommended,
    ...(result.evaluationMetadata === undefined
      ? {}
      : { evaluationMetadata: { ...result.evaluationMetadata } }),
  };
}
