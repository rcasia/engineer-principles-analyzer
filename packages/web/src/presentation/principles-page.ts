import type { Principle } from "@epa/core";
import { DESIGN_SYSTEM_CSS } from "./design-system.ts";

export const PAGE_TITLE = "Engineer Principles Analyzer";
export const EMPTY_STATE = "No principles are defined yet.";

/**
 * Escapes text before it reaches HTML. Principles will eventually come from
 * user-controlled sources, so this is applied at the boundary, always.
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPrinciples(principles: readonly Principle[]): string {
  if (principles.length === 0) {
    return `<div class="empty-state"><strong>Catalog is empty</strong><p>${EMPTY_STATE}</p></div>`;
  }

  const items = principles
    .map(
      (principle) =>
        `<li class="principle"><h2>${escapeHtml(principle.title)}</h2><p>${escapeHtml(principle.id)}</p></li>`,
    )
    .join("");

  return `<ul aria-label="Engineering principles" class="principles-list">${items}</ul>`;
}

/**
 * Renders the whole page server side. There is deliberately no client-side
 * JavaScript: the page is usable with scripting disabled, is reachable by
 * keyboard and screen reader by construction, and costs nothing to serve.
 */
export function renderPrinciplesPage(principles: readonly Principle[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>${PAGE_TITLE}</title>
<style>${DESIGN_SYSTEM_CSS}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__inner">
    <a class="brand" href="/"><span class="brand__mark" aria-hidden="true">P/</span><span>Principled</span></a>
    <nav class="topnav" aria-label="Primary">
      <a href="/" aria-current="page">Principles</a>
      <a href="/design">Design system</a>
    </nav>
  </div>
</header>
<main class="page" id="main">
<header class="page-header">
<p class="eyebrow">Engineering reference</p>
<h1>${PAGE_TITLE}</h1>
<p class="lede">Explicit principles for evaluating software decisions and the evidence behind them.</p>
</header>
${renderPrinciples(principles)}
</main>
<footer class="footer">Principled · evidence before opinion</footer>
</body>
</html>`;
}
