/**
 * Live findings renderer for the `/analyze` realtime island (ADR-0040).
 *
 * Pure functions from the live JSON shapes to the HTML injected into the
 * `aria-live` findings region. The markup mirrors the server findings page
 * (`analyze-page.ts`) — same badges, summary wording, evidence blocks and
 * empty states — so the live region and the no-JS page read as one design.
 * The strings both sides share (`NO_FINDINGS_MESSAGE`, `PROBABILISTIC_NOTE`,
 * the live status lines) come from `analysis-payload.ts` by construction;
 * the badge classes and summary shape are pinned by mirrored tests here and
 * there, which is the documented cost of the second renderer.
 *
 * Everything interpolated passes through `escapeHtml`: the JSON answer is
 * first-party, but excerpts carry raw visitor source.
 */
import {
  LIVE_RESULTS_EMPTY_MESSAGE,
  NO_FINDINGS_MESSAGE,
  PROBABILISTIC_NOTE,
  type PlainEvidence,
  type PlainResult,
} from "../presentation/analysis-payload.ts";
import { languageLabel } from "../presentation/language-display.ts";

const STATUS_BADGE_CLASS: Readonly<Record<string, string>> = {
  compliant: "badge--success",
  violation: "badge--error",
  uncertain: "badge--warning",
  not_applicable: "badge--info",
  unable_to_analyze: "badge--error",
};

const STATUS_LABEL: Readonly<Record<string, string>> = {
  compliant: "Compliant",
  violation: "Violation",
  uncertain: "Uncertain",
  not_applicable: "Not applicable",
  unable_to_analyze: "Unable to analyze",
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Rounds a `Confidence` (0-1) to a whole-number percentage for display. */
function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatLocation(location: PlainEvidence["location"]): string {
  const lines =
    location.startLine === location.endLine
      ? `Line ${location.startLine}`
      : `Lines ${location.startLine}–${location.endLine}`;
  const withColumn =
    location.startColumn === undefined
      ? lines
      : `${lines}, column ${location.startColumn}`;

  return location.filePath === undefined
    ? withColumn
    : `${escapeHtml(location.filePath)} · ${withColumn}`;
}

function renderEvidenceItem(item: PlainEvidence): string {
  return `<li class="finding-evidence"><p class="type-mono">${formatLocation(item.location)}</p><div class="code-block"><pre><code>${escapeHtml(item.excerpt)}</code></pre></div></li>`;
}

function renderEvidence(evidence: readonly PlainEvidence[]): string {
  if (evidence.length === 0) {
    return "";
  }

  return `<div><h4>Evidence</h4><ul class="finding-evidence-list">${evidence.map(renderEvidenceItem).join("")}</ul></div>`;
}

function renderLimitations(limitations: readonly string[]): string {
  if (limitations.length === 0) {
    return "";
  }

  return `<ul class="field__help">${limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join("")}</ul>`;
}

function renderRemediation(remediation: string | undefined): string {
  return remediation === undefined
    ? ""
    : `<p><strong>Suggested fix:</strong> ${escapeHtml(remediation)}</p>`;
}

function renderProvenance(result: PlainResult): string {
  return `<p class="finding-meta">Analyzed as ${escapeHtml(languageLabel(result.language))} · ${escapeHtml(result.analyzer.name)} v${escapeHtml(result.analyzer.version)}</p>`;
}

function renderFinding(result: PlainResult, index: number): string {
  const headingId = `finding-${index}-heading`;
  const reviewBadge = result.humanReviewRecommended
    ? '<span class="badge badge--warning">Human review recommended</span>'
    : "";

  return `<li>
<article class="panel finding" aria-labelledby="${headingId}">
  <div class="status-row">
    <span class="badge ${STATUS_BADGE_CLASS[result.status] ?? "badge--info"}">${escapeHtml(STATUS_LABEL[result.status] ?? result.status)}</span>
    <span class="badge">${escapeHtml(result.method)}</span>
    <span class="badge">${formatConfidence(result.confidence)} confidence</span>
    ${reviewBadge}
  </div>
  <h3 id="${headingId}" class="card-title">${escapeHtml(result.ruleId)}</h3>
  <p class="card-copy">${escapeHtml(result.explanation)}</p>
  ${renderEvidence(result.evidence)}
  ${renderRemediation(result.remediation)}
  ${renderLimitations(result.limitations)}
  ${renderProvenance(result)}
</article>
</li>`;
}

/**
 * One line saying what the run produced overall: total findings plus a
 * per-status breakdown in first-seen order. Rendered only when there is at
 * least one finding — the empty state already says what an empty run means.
 */
function renderSummary(results: readonly PlainResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const counts = new Map<string, number>();

  for (const result of results) {
    counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  }

  const parts = [...counts.entries()].map(
    ([status, count]) =>
      `${count} ${(STATUS_LABEL[status] ?? status).toLowerCase()}`,
  );
  const total = results.length;

  return `<p class="results-summary">${total} finding${total === 1 ? "" : "s"}: ${parts.join(" · ")}</p>`;
}

/**
 * Findings for a completed live run: summary, probabilistic disclosure and
 * the list — or the empty-run state when no rule produced a finding.
 */
export function renderLiveFindings(
  results: readonly PlainResult[],
): string {
  if (results.length === 0) {
    return `<div class="empty-state"><strong>No findings</strong><p>${NO_FINDINGS_MESSAGE}</p></div>`;
  }

  return `${renderSummary(results)}<p class="results-note">${PROBABILISTIC_NOTE}</p><ol aria-label="Analysis findings" class="findings-list">${results.map(renderFinding).join("")}</ol>`;
}

/** The pre-first-keystroke state, byte-identical to the server render. */
export function renderLiveEmpty(): string {
  return `<div class="empty-state"><strong>No findings yet</strong><p>${LIVE_RESULTS_EMPTY_MESSAGE}</p></div>`;
}

/** A rejected run or an unreachable service, with the message escaped. */
export function renderLiveError(message: string): string {
  return `<div class="notice"><p>${escapeHtml(message)}</p></div>`;
}

/**
 * The in-flight state: skeleton cards plus the progress line. `aria-hidden`
 * throughout — the toolbar `role="status"` line carries the announcement.
 */
export function renderLiveAnalyzing(): string {
  return `<div class="state" aria-hidden="true"><div class="skeleton"><span></span><span></span><span></span></div><div class="progress-line"></div></div>`;
}
