import type { Principle } from "@principled/core";
import { DESIGN_SYSTEM_CSS } from "./design-system.ts";
import { VERSION } from "../version.ts";
import { renderPrinciplesList } from "./principles-list.tsx";

export const PAGE_TITLE = "Principled";
export { EMPTY_STATE } from "./principles-list.tsx";

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

/**
 * Renders the list fragment through the SSR-only component. The page shell
 * stays a string template in Phase 1; only the list migrates, and no
 * `<script>` tag is added, so scripting-disabled output is unchanged apart
 * from React's stricter escaping (`'` becomes `&#x27;`).
 */
function renderPrinciples(principles: readonly Principle[]): string {
  return renderPrinciplesList(principles);
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
      <a href="/analyze">Analyze</a>
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
<footer class="footer">Principled · evidence before opinion · v${VERSION}</footer>
</body>
</html>`;
}
