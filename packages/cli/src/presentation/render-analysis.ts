import type { AnalysisResult } from "@principled/core";

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Human-readable rendering of completed findings: one block per result.
 * Presentation only — machine consumers should use `--format json|sarif`.
 */
export function renderFindings(results: readonly AnalysisResult[]): string {
  if (results.length === 0) {
    return "No rules were available to evaluate this input.";
  }

  return results
    .map((result) => {
      const lines = [
        `${result.status} ${result.ruleId} (${formatConfidence(result.confidence.value)} confidence, ${result.method})`,
        result.explanation,
      ];

      for (const item of result.evidence) {
        const span =
          item.location.startLine === item.location.endLine
            ? `line ${item.location.startLine}`
            : `lines ${item.location.startLine}-${item.location.endLine}`;
        lines.push(`evidence ${span}: ${item.excerpt}`);
      }

      if (result.remediation !== undefined) {
        lines.push(`suggested fix: ${result.remediation}`);
      }

      if (result.humanReviewRecommended) {
        lines.push("human review recommended");
      }

      return lines.join("\n");
    })
    .join("\n\n");
}
