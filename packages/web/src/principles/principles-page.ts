import type { Principle } from "@principled/core";
import { escapeHtml, renderPage } from "../shared/layout.ts";
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
  const cta =
    principles.length === 0
      ? ""
      : `<p class="principles__cta"><a class="button button--primary" href="/analyze">Analyze a file against these principles →</a></p>`;

  return renderPage({
    title: PAGE_TITLE,
    path: "/principles",
    body: `<header class="page-header">
<p class="eyebrow">The engineering contract</p>
<h1>Principles</h1>
<p class="lede">Principles are the standards Principled measures code against. Each one is a written-down position on what good design is — and the rules the analyzer runs are its checkable form. What counts and what does not is decided here, before any file is judged.</p>
</header>
<ol class="principles__flow" aria-label="How principles become findings">
  <li>
    <h2>Principle</h2>
    <p>The standard, written down: what it guards and why it matters.</p>
  </li>
  <li>
    <h2>Rule</h2>
    <p>The principle's checkable form, run against submitted code.</p>
  </li>
  <li>
    <h2>Finding</h2>
    <p>The result of the rule: verdict, evidence and confidence, naming its principle.</p>
  </li>
</ol>
${renderPrinciples(principles)}${cta}`,
  });
}
