import type { Principle } from "@epa/core";

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
    return `<p>${EMPTY_STATE}</p>`;
  }

  const items = principles
    .map(
      (principle) =>
        `<li><h2>${escapeHtml(principle.title)}</h2><p>${escapeHtml(principle.id)}</p></li>`,
    )
    .join("");

  return `<ul aria-label="Engineering principles">${items}</ul>`;
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
<title>${PAGE_TITLE}</title>
<style>
:root { color-scheme: light dark; --fg: #12131a; --bg: #ffffff; --accent: #0b5cd5; }
@media (prefers-color-scheme: dark) {
  :root { --fg: #f2f3f7; --bg: #12131a; --accent: #8ab4ff; }
}
body {
  margin: 0 auto; padding: 2rem 1rem; max-width: 42rem;
  font: 1rem/1.6 system-ui, sans-serif; color: var(--fg); background: var(--bg);
}
ul { list-style: none; padding: 0; }
li { border-block-end: 1px solid color-mix(in srgb, var(--fg) 20%, transparent); padding-block: 1rem; }
h2 { font-size: 1.1rem; margin: 0 0 .25rem; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<main>
<h1>${PAGE_TITLE}</h1>
${renderPrinciples(principles)}
</main>
</body>
</html>`;
}
