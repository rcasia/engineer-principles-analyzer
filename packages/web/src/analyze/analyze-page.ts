import type {
  AnalysisResult,
  AnalysisStatus,
  Evidence,
  SourceLocation,
} from "@principled/core";
import {
  LIVE_RESULTS_EMPTY_MESSAGE,
  LIVE_STATUS_EMPTY,
  NO_FINDINGS_MESSAGE,
  PROBABILISTIC_NOTE,
} from "./analysis-payload.ts";
import { CODE_EXAMPLES, exampleFor } from "./code-examples.ts";
import { escapeHtml, renderPage } from "../shared/layout.ts";
import {
  AUTO_DETECT_LABEL,
  extensionFor,
  languageLabel,
} from "./language-display.ts";

export const ANALYZE_PAGE_TITLE = "Analyze | Principled";
export { AUTO_DETECT_LABEL };
export { NO_FINDINGS_MESSAGE };

/**
 * What the `/analyze` page can show, chosen by the request handler
 * (ADR-0015, ADR-0042): the realtime playground on `GET` — blank, or
 * prefilled when the visitor followed a `?example=` link — a validation
 * error that preserves what the visitor typed, or the structured findings
 * from a completed run. The playground carries no submit button: the live
 * island analyses as the visitor types into the `aria-live` findings
 * region, while a `<noscript>` submit button keeps the same form working
 * with scripting disabled. There is deliberately no fourth "loading"
 * variant in the server views — see ADR-0015 for why a page with no
 * client-side JavaScript (ADR-0004) does not need one; the loading state
 * lives in the island, announced through `role="status"`.
 *
 * `language` is display-only and always detector-produced ("" means
 * unknown): the visitor has no language control (ADR-0026).
 */
export type AnalyzeView =
  | {
      readonly kind: "form";
      readonly sourceCode: string;
      readonly language: string;
      readonly exampleId: string | null;
    }
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

/**
 * Where a finding came from, in plain display terms (#35): the language
 * the subject was analysed as, and the exact analyzer name and version
 * behind the verdict, so a finding is attributable to a versioned
 * implementation rather than floating as an anonymous judgment. All three
 * values originate in `AnalysisResult` fields the contract already
 * carries — the page renders them, it does not invent them.
 */
function renderProvenance(result: AnalysisResult): string {
  return `<p class="finding-meta">Analyzed as ${escapeHtml(languageLabel(result.language))} · ${escapeHtml(result.analyzer.name)} v${escapeHtml(result.analyzer.version)}</p>`;
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
  ${renderProvenance(result)}
</article>
</li>`;
}

function renderFindings(results: readonly AnalysisResult[]): string {
  if (results.length === 0) {
    return `<div class="empty-state"><strong>No findings</strong><p>${NO_FINDINGS_MESSAGE}</p></div>`;
  }

  return `<ol aria-label="Analysis findings" class="findings-list">${results.map(renderFinding).join("")}</ol>`;
}

/**
 * One line saying what the run produced overall (#17): total findings plus
 * a per-status breakdown in first-seen order, so a mixed run reads as
 * "3 findings: 1 violation · 1 uncertain · 1 compliant" at a glance.
 * Rendered only when there is at least one finding — the empty state
 * already says what an empty run means.
 */
function renderSummary(results: readonly AnalysisResult[]): string {
  if (results.length === 0) {
    return "";
  }

  const counts = new Map<AnalysisStatus, number>();

  for (const result of results) {
    counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  }

  const parts = [...counts.entries()].map(
    ([status, count]) => `${count} ${STATUS_LABEL[status].toLowerCase()}`,
  );
  const total = results.length;

  return `<p class="results-summary">${total} finding${total === 1 ? "" : "s"}: ${parts.join(" · ")}</p>`;
}

function renderProbabilisticNote(results: readonly AnalysisResult[]): string {
  if (results.length === 0) {
    return "";
  }

  return `<p class="results-note">${PROBABILISTIC_NOTE}</p>`;
}

function renderErrorBanner(message: string): string {
  return `<div class="field__error" id="analyze-error" role="alert">${escapeHtml(message)}</div>`;
}

/**
 * The filename in the editor toolbar. Real for examples, derived for
 * anything the visitor typed. Every source here is static or map-derived,
 * never user input, so there is nothing to escape.
 */
function filenameFor(language: string, exampleId: string | null): string {
  const example = exampleFor(exampleId);

  if (example !== undefined) {
    return example.filename;
  }

  return `snippet.${extensionFor(language)}`;
}

/**
 * "0 lines" for the empty buffer, singular for one. Split on "\n" only:
 * the textarea normalises newlines on submit, so this matches what the
 * backend will receive.
 */
function lineCountLabel(sourceCode: string): string {
  if (sourceCode.length === 0) {
    return "0 lines";
  }

  const count = sourceCode.split("\n").length;

  return count === 1 ? "1 line" : `${count} lines`;
}

/**
 * Static line numbers beside the editor. Exactly one `<span>` per line of
 * the loaded buffer — empty means no spans, so the numbers never show
 * content that is not there. The grid row stretches the empty gutter to the
 * textarea height, so no filler numbers are needed to hold the geometry.
 * With no client-side JavaScript (ADR-0004) they cannot track typing, which
 * is why they describe the loaded buffer rather than pretend to be live;
 * live updates are Phase 2 hydration reusing `client/gutter.ts` (ADR-0023).
 */
function renderGutter(sourceCode: string): string {
  if (sourceCode === "") {
    return `<div class="editor__gutter" aria-hidden="true"></div>`;
  }

  const lines: string[] = [];
  const count = sourceCode.split("\n").length;

  for (let line = 1; line <= count; line += 1) {
    lines.push(`<span>${line}</span>`);
  }

  return `<div class="editor__gutter" aria-hidden="true">${lines.join("")}</div>`;
}

/**
 * The live findings region (ADR-0042): an `aria-live` container the island
 * fills as the visitor types, so findings arrive with no submit step and
 * no navigation. Server-rendered with the empty state — with scripting
 * disabled the island never runs and the `<noscript>` submit button in the
 * toolbar posts the form to the findings page instead.
 */
function renderLiveResults(): string {
  return `<section class="results-live" aria-labelledby="results-heading">
  <h2 id="results-heading">Findings</h2>
  <div id="liveResults" aria-live="polite"><div class="empty-state"><strong>No findings yet</strong><p>${LIVE_RESULTS_EMPTY_MESSAGE}</p></div></div>
</section>`;
}

/** Plain navigations: each link reloads the page with the editor prefilled, no script involved. The client island (`example-switcher.ts`) intercepts them for reload-free filling when it loads. */
function renderExamples(activeId: string | null): string {
  const links = CODE_EXAMPLES.map((example) => {
    const current = activeId === example.id ? ' aria-current="true"' : "";

    return `<a class="button" href="/analyze?example=${example.id}"${current}>${example.label}</a>`;
  }).join("");

  return `<section class="examples" aria-labelledby="examples-heading">
  <h2 id="examples-heading">Try an example</h2>
  <div class="button-row">${links}</div>
</section>`;
}

function renderPlayground(options: {
  readonly sourceCode: string;
  readonly language: string;
  readonly invalid: boolean;
  readonly exampleId: string | null;
}): string {
  const invalidAttr = options.invalid
    ? ' aria-invalid="true" aria-describedby="analyze-error"'
    : "";
  const example = exampleFor(options.exampleId);
  const exampleAttrs =
    example === undefined
      ? ""
      : ` data-example-filename="${example.filename}"`;

  return `<form id="analyzeForm" method="post" action="/analyze" enctype="multipart/form-data" class="analyze-form"${exampleAttrs}>
  <div class="analyze-grid">
    <section class="panel editor" aria-label="Source code editor">
      <div class="editor__toolbar">
        <span class="editor__filename" id="editorFilename">${filenameFor(options.language, options.exampleId)}</span>
        <span class="editor__actions">
          <label class="button" for="sourceFile" title="If a file is chosen it is used instead of the pasted text">Upload</label>
          <input class="visually-hidden" id="sourceFile" name="sourceFile" type="file">
          <span class="editor__language" id="editorLanguage" data-language="${escapeHtml(options.language)}" aria-label="Language is detected automatically">Auto-detect</span>
        </span>
      </div>
      <div class="editor__body">
        ${renderGutter(options.sourceCode)}
        <div class="editor__stage">
          <pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight">${escapeHtml(options.sourceCode)}</code></pre>
          <label class="visually-hidden" for="sourceCode">Source code</label>
          <textarea class="editor__input" id="sourceCode" name="sourceCode" rows="16" spellcheck="false"${invalidAttr} placeholder="Paste exactly one source file">${escapeHtml(options.sourceCode)}</textarea>
        </div>
      </div>
    </section>
    <div class="analyze-rail">
      ${renderLiveResults()}
    </div>
  </div>
  <div class="analyze-toolbar">
    <p class="analyze-toolbar__meta" id="editorMeta">${escapeHtml(languageLabel(options.language))} · ${lineCountLabel(options.sourceCode)}</p>
    <p class="analyze-status" id="analyzeStatus" role="status">${LIVE_STATUS_EMPTY}</p>
    <noscript><button class="button button--primary" type="submit">Analyze →</button></noscript>
  </div>
</form>
${renderExamples(options.exampleId)}
<p class="playground__note">Single-file analysis · Nothing you submit is stored.</p>`;
}

function renderPlaygroundHeader(): string {
  return `<header class="page-header">
<p class="eyebrow">Code → principles → findings</p>
<h1>Analyze</h1>
<p class="lede">Paste or upload one source file — findings appear beside the editor as you type, with no submit step. Each rule that applies returns a finding: a verdict, the lines of code it judged, a confidence level, and a suggested fix where the rule knows one.</p>
</header>`;
}

function renderMain(view: AnalyzeView): string {
  switch (view.kind) {
    case "form":
      return `${renderPlaygroundHeader()}
${renderPlayground({ sourceCode: view.sourceCode, language: view.language, invalid: false, exampleId: view.exampleId })}`;
    case "invalid":
      return `${renderPlaygroundHeader()}
${renderErrorBanner(view.message)}
${renderPlayground({ sourceCode: view.sourceCode, language: view.language, invalid: true, exampleId: null })}`;
    case "completed":
      return `<header class="page-header">
<p class="eyebrow">Single-file analysis</p>
<h1>Analysis results</h1>
<p class="lede">Findings are scoped to the file you submitted. Principled does not make claims about how it relates to the rest of a project.</p>
</header>
${renderSummary(view.results)}
${renderProbabilisticNote(view.results)}
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
 * (ADR-0015: the empty form, a validation error and completed findings are
 * three full page renders, not three states of one script). The playground
 * gets the full content width; findings stay at reading width.
 *
 * `scriptSrc` is the hashed live-highlight bundle (ADR-0029). It is
 * rendered only when a built bundle is available; without it the page is
 * the plain server-rendered form, so the no-JS baseline keeps working.
 */
export function renderAnalyzePage(
  view: AnalyzeView,
  options?: { readonly scriptSrc?: string | undefined },
): string {
  const script =
    options?.scriptSrc === undefined
      ? undefined
      : `<script type="module" src="${options.scriptSrc}"></script>\n`;

  return renderPage({
    title: ANALYZE_PAGE_TITLE,
    path: "/analyze",
    mainClass: view.kind === "completed" ? "page" : "playground",
    body: renderMain(view),
    script,
  });
}
