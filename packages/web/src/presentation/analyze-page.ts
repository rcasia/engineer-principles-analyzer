import type {
  AnalysisResult,
  AnalysisStatus,
  Evidence,
  SourceLocation,
} from "@principled/core";
import { DESIGN_SYSTEM_CSS } from "./design-system.ts";
import { escapeHtml } from "./principles-page.ts";

export const ANALYZE_PAGE_TITLE = "Analyze | Principled";
export const DEFAULT_LANGUAGE = "typescript";
export const NO_FINDINGS_MESSAGE =
  "The analysis completed, but no rules were available to evaluate this submission.";

/**
 * What the `/analyze` page can show, chosen by the request handler
 * (ADR-0015): the blank form on `GET`, a validation error that preserves
 * what the visitor typed, or the structured findings from a completed run.
 * There is deliberately no fourth "loading" variant — see ADR-0015 for why
 * a page with no client-side JavaScript (ADR-0004) does not need one.
 */
export type AnalyzeView =
  | { readonly kind: "form" }
  | {
      readonly kind: "invalid";
      readonly message: string;
      readonly sourceCode: string;
      readonly language: string;
    }
  | { readonly kind: "completed"; readonly results: readonly AnalysisResult[] };

const STATUS_BADGE_CLASS: Record<AnalysisStatus, string> = {
  compliant: "badge--success",
  violation: "badge--error",
  uncertain: "badge--warning",
  not_applicable: "badge--info",
  unable_to_analyze: "badge--error",
};

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  compliant: "Compliant",
  violation: "Violation",
  uncertain: "Uncertain",
  not_applicable: "Not applicable",
  unable_to_analyze: "Unable to analyze",
};

/** Rounds a `Confidence` (0-1) to a whole-number percentage for display. */
function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * A short, single-file location string. Never includes `filePath` from a
 * different subject and never implies more than one file is involved
 * (#34's "the UI does not make cross-file claims").
 */
function formatLocation(location: SourceLocation): string {
  const lines =
    location.startLine === location.endLine
      ? `Line ${location.startLine}`
      : `Lines ${location.startLine}\u2013${location.endLine}`;
  const withColumn =
    location.startColumn === undefined
      ? lines
      : `${lines}, column ${location.startColumn}`;

  return location.filePath === undefined
    ? withColumn
    : `${escapeHtml(location.filePath)} \u00b7 ${withColumn}`;
}

function renderEvidenceItem(item: Evidence): string {
  return `<li class="finding-evidence"><p class="type-mono">${formatLocation(item.location)}</p><div class="code-block"><pre><code>${escapeHtml(item.excerpt)}</code></pre></div></li>`;
}

function renderEvidence(evidence: readonly Evidence[]): string {
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

function renderFinding(result: AnalysisResult, index: number): string {
  const headingId = `finding-${index}-heading`;
  const reviewBadge = result.humanReviewRecommended
    ? '<span class="badge badge--warning">Human review recommended</span>'
    : "";

  return `<li>
<article class="panel finding" aria-labelledby="${headingId}">
  <div class="status-row">
    <span class="badge ${STATUS_BADGE_CLASS[result.status]}">${STATUS_LABEL[result.status]}</span>
    <span class="badge">${escapeHtml(result.method)}</span>
    <span class="badge">${formatConfidence(result.confidence.value)} confidence</span>
    ${reviewBadge}
  </div>
  <h3 id="${headingId}" class="card-title">${escapeHtml(result.ruleId)}</h3>
  <p class="card-copy">${escapeHtml(result.explanation)}</p>
  ${renderEvidence(result.evidence)}
  ${renderRemediation(result.remediation)}
  ${renderLimitations(result.limitations)}
</article>
</li>`;
}

function renderFindings(results: readonly AnalysisResult[]): string {
  if (results.length === 0) {
    return `<div class="empty-state"><strong>No findings</strong><p>${NO_FINDINGS_MESSAGE}</p></div>`;
  }

  return `<ol aria-label="Analysis findings" class="findings-list">${results.map(renderFinding).join("")}</ol>`;
}

function renderErrorBanner(message: string): string {
  return `<div class="field__error" role="alert">${escapeHtml(message)}</div>`;
}

function renderForm(options: {
  readonly sourceCode: string;
  readonly language: string;
  readonly invalid: boolean;
}): string {
  const invalidAttr = options.invalid ? ' aria-invalid="true"' : "";

  return `<form method="post" action="/analyze" enctype="multipart/form-data" class="analyze-form">
  <div class="field field--wide">
    <label for="sourceCode">Paste source code</label>
    <textarea class="textarea" id="sourceCode" name="sourceCode" rows="16" spellcheck="false"${invalidAttr} placeholder="Paste exactly one source file">${escapeHtml(options.sourceCode)}</textarea>
    <p class="field__help">Or choose a single file below. If both are given, the file is used.</p>
  </div>
  <div class="field-grid">
    <div class="field">
      <label for="sourceFile">Source file</label>
      <input class="input" id="sourceFile" name="sourceFile" type="file">
    </div>
    <div class="field">
      <label for="language">Language</label>
      <input class="input" id="language" name="language" type="text" value="${escapeHtml(options.language)}" required>
    </div>
  </div>
  <div class="button-row">
    <button class="button button--primary" type="submit">Analyze</button>
  </div>
</form>`;
}

function renderMain(view: AnalyzeView): string {
  switch (view.kind) {
    case "form":
      return `<header class="page-header">
<p class="eyebrow">Single-file analysis</p>
<h1>Analyze a source file</h1>
<p class="lede">Paste or submit exactly one file to check it against the engineering principles Principled can evaluate. Nothing you submit is stored.</p>
</header>
${renderForm({ sourceCode: "", language: DEFAULT_LANGUAGE, invalid: false })}`;
    case "invalid":
      return `<header class="page-header">
<p class="eyebrow">Single-file analysis</p>
<h1>Analyze a source file</h1>
<p class="lede">Paste or submit exactly one file to check it against the engineering principles Principled can evaluate. Nothing you submit is stored.</p>
</header>
${renderErrorBanner(view.message)}
${renderForm({ sourceCode: view.sourceCode, language: view.language, invalid: true })}`;
    case "completed":
      return `<header class="page-header">
<p class="eyebrow">Single-file analysis</p>
<h1>Analysis results</h1>
<p class="lede">Findings are scoped to the file you submitted. Principled does not make claims about how it relates to the rest of a project.</p>
</header>
${renderFindings(view.results)}
<p class="button-row"><a class="button" href="/analyze">Analyze another file</a></p>`;
    default: {
      const unreachable: never = view;
      throw new Error(`Unknown AnalyzeView kind: ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Renders the whole `/analyze` page server side, for every {@link AnalyzeView}
 * (ADR-0004: no client-side JavaScript at all, so the empty form, a
 * validation error and completed findings are three full page renders, not
 * three states of one script).
 */
export function renderAnalyzePage(view: AnalyzeView): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>${ANALYZE_PAGE_TITLE}</title>
<style>${DESIGN_SYSTEM_CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__inner">
    <a class="brand" href="/"><span class="brand__mark" aria-hidden="true">P/</span><span>Principled</span></a>
    <nav class="topnav" aria-label="Primary">
      <a href="/">Principles</a>
      <a href="/analyze" aria-current="page">Analyze</a>
      <a href="/design">Design system</a>
    </nav>
  </div>
</header>
<main class="page" id="main">
${renderMain(view)}
</main>
<footer class="footer">Principled · evidence before opinion</footer>
</body>
</html>`;
}
