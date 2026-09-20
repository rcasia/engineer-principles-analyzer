import type { Principle } from "@principled/core";
import { escapeHtml, renderPage } from "./layout.ts";
import { renderPrinciplesList } from "./principles-list.tsx";

export const PAGE_TITLE = "Principles | Principled";
export { EMPTY_STATE } from "./principles-list.tsx";
export { escapeHtml };

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
  return renderPage({
    title: PAGE_TITLE,
    path: "/principles",
    body: `<header class="page-header">
<p class="eyebrow">Engineering reference</p>
<h1>Principles</h1>
<p class="lede">Explicit principles for evaluating software decisions and the evidence behind them.</p>
</header>
${renderPrinciples(principles)}`,
  });
}
