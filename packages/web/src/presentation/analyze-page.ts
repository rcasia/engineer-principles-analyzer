import type {
  AnalysisResult,
  AnalysisStatus,
  Evidence,
  SourceLocation,
} from "@principled/core";
import { CODE_EXAMPLES, exampleFor } from "./code-examples.ts";
import { DESIGN_SYSTEM_CSS } from "./design-system.ts";
import { escapeHtml } from "./principles-page.ts";
import { VERSION } from "../version.ts";

export const ANALYZE_PAGE_TITLE = "Analyze | Principled";
/** Shown wherever a language would appear but detection has nothing to show yet. */
export const AUTO_DETECT_LABEL = "Auto-detect";
export const NO_FINDINGS_MESSAGE =
  "The analysis completed, but no rules were available to evaluate this submission.";

/**
 * What the `/analyze` page can show, chosen by the request handler
 * (ADR-0015): the playground on `GET` — blank, or prefilled when the
 * visitor followed a `?example=` link — a validation error that preserves
 * what the visitor typed, or the structured findings from a completed run.
 * There is deliberately no fourth "loading" variant — see ADR-0015 for why
 * a page with no client-side JavaScript (ADR-0004) does not need one.
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
  return `<div class="field__error" id="analyze-error" role="alert">${escapeHtml(message)}</div>`;
}

/**
 * Display names and file extensions per language, as shown in the editor
 * toolbar and status bar. The backend accepts any free-text language, so an
 * unlisted one is echoed back untouched with a plain `.txt` filename rather
 * than rejected.
 */
const LANGUAGE_DETAILS: Record<
  string,
  { readonly label: string; readonly extension: string }
> = {
  typescript: { label: "TypeScript", extension: "ts" },
  javascript: { label: "JavaScript", extension: "js" },
  python: { label: "Python", extension: "py" },
  go: { label: "Go", extension: "go" },
  rust: { label: "Rust", extension: "rs" },
  java: { label: "Java", extension: "java" },
};

function canonicalLanguage(language: string): string {
  return language.trim().toLowerCase();
}

/** Display name for a detector-produced language; "" renders as auto-detect. */
function languageLabel(language: string): string {
  if (canonicalLanguage(language) === "") {
    return AUTO_DETECT_LABEL;
  }

  return LANGUAGE_DETAILS[canonicalLanguage(language)]?.label ?? language;
}

function extensionFor(language: string): string {
  return LANGUAGE_DETAILS[canonicalLanguage(language)]?.extension ?? "txt";
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
 * Static line numbers beside the editor. Sized to the initial content with
 * a floor that fills the empty editor; with no client-side JavaScript
 * (ADR-0004) they cannot track typing, which is why they describe the
 * loaded buffer rather than pretend to be live.
 */
const MIN_GUTTER_LINES = 24;

function gutterLineCount(sourceCode: string): number {
  return Math.max(sourceCode.split("\n").length, MIN_GUTTER_LINES);
}

function renderGutter(sourceCode: string): string {
  const lines: string[] = [];
  const count = gutterLineCount(sourceCode);

  for (let line = 1; line <= count; line += 1) {
    lines.push(`<span>${line}</span>`);
  }

  return `<div class="editor__gutter" aria-hidden="true">${lines.join("")}</div>`;
}

/**
 * The engineering contract the code is tested against, as static display:
 * the rule catalog is still empty (no rule-selection backend exists yet),
 * so these are deliberately `checked disabled` — visibly on, not
 * configurable here, and never submitted with the form.
 */
const CONTRACT_GROUPS: readonly {
  readonly title: string;
  readonly principles: readonly string[];
}[] = [
  {
    title: "Architecture",
    principles: ["Hexagonal Architecture", "Dependency Direction"],
  },
  { title: "Design", principles: ["SOLID", "Single Responsibility"] },
  { title: "Testing", principles: ["DTT"] },
];

function renderContractGroup(group: {
  readonly title: string;
  readonly principles: readonly string[];
}): string {
  const items = group.principles
    .map(
      (principle) =>
        `<label class="contract__item"><input type="checkbox" checked disabled><span>${principle}</span></label>`,
    )
    .join("");

  return `<div class="contract__group"><h3 class="contract__group-title">${group.title}</h3><div class="contract__items">${items}</div></div>`;
}

function renderContract(): string {
  const groups = CONTRACT_GROUPS.map(renderContractGroup).join("");
  const total = CONTRACT_GROUPS.reduce(
    (count, group) => count + group.principles.length,
    0,
  );

  return `<section class="panel contract" aria-labelledby="contract-heading">
  <h2 class="panel__label" id="contract-heading">Engineering contract</h2>
  ${groups}
  <p class="contract__count">${total} principles enabled</p>
</section>`;
}

/** Plain navigations: each link reloads the page with the editor prefilled, no script involved. */
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

  return `<form method="post" action="/analyze" enctype="multipart/form-data" class="analyze-form">
  <div class="analyze-grid">
    <section class="panel editor" aria-label="Source code editor">
      <div class="editor__toolbar">
        <span class="editor__filename">${filenameFor(options.language, options.exampleId)}</span>
        <span class="editor__actions">
          <label class="button" for="sourceFile" title="If a file is chosen it is used instead of the pasted text">Upload</label>
          <input class="visually-hidden" id="sourceFile" name="sourceFile" type="file">
          <span class="editor__language" aria-label="Language is detected automatically">Auto-detect</span>
        </span>
      </div>
      <div class="editor__body">
        ${renderGutter(options.sourceCode)}
        <label class="visually-hidden" for="sourceCode">Source code</label>
        <textarea class="editor__input" id="sourceCode" name="sourceCode" rows="16" spellcheck="false"${invalidAttr} placeholder="Paste exactly one source file">${escapeHtml(options.sourceCode)}</textarea>
      </div>
    </section>
    ${renderContract()}
  </div>
  <div class="analyze-toolbar">
    <p class="analyze-toolbar__meta">${escapeHtml(languageLabel(options.language))} · ${lineCountLabel(options.sourceCode)}</p>
    <button class="button button--primary" type="submit">Analyze →</button>
  </div>
</form>
${renderExamples(options.exampleId)}
<p class="playground__note">Single-file analysis · Nothing you submit is stored.</p>`;
}

function renderPlaygroundHeader(): string {
  return `<header class="page-header">
<p class="eyebrow">Code → principles → findings</p>
<h1>Analyze</h1>
<p class="lede">Test your engineering principles against real code.</p>
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
 * three states of one script). The playground gets the full content width;
 * findings stay at reading width.
 */
export function renderAnalyzePage(view: AnalyzeView): string {
  const mainClass = view.kind === "completed" ? "page" : "playground";

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
<main class="${mainClass}" id="main">
${renderMain(view)}
</main>
<footer class="footer">Principled · evidence before opinion · v${VERSION}</footer>
</body>
</html>`;
}
