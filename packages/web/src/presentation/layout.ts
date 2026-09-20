import { DESIGN_SYSTEM_CSS } from "./design-system.ts";
import { VERSION } from "../version.ts";

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
 * The primary navigation, defined once so every page agrees on what the
 * product is made of: `label` is what visitors see, `href` is the route.
 * Pages render this list and mark the current one, never their own copy.
 */
export const NAV_ITEMS: readonly { readonly href: string; readonly label: string }[] =
  [
    { href: "/principles", label: "Principles" },
    { href: "/analyze", label: "Analyze" },
    { href: "/design", label: "Design system" },
  ];

export const FOOTER = `Principled · evidence before opinion · v${VERSION}`;

export interface PageOptions {
  readonly title: string;
  /** Optional `<meta name="description">`; escaped like any other text. */
  readonly description?: string | undefined;
  /** The route this page serves; selects the nav item marked `aria-current`. */
  readonly path: string;
  /** Reading width (`"page"`, the default) or standard width (`"playground"`). */
  readonly mainClass?: "page" | "playground";
  readonly body: string;
  /** Trailing `<head>` chrome, e.g. the hashed editor bundle's `<script>` tag. */
  readonly script?: string | undefined;
}

/**
 * The document every string-template page shares: doctype, head, skip link,
 * top bar with the one primary navigation, main landmark and footer. Pages
 * provide only their `body`, so the chrome — and with it the product's
 * identity and navigation — cannot drift from page to page.
 */
export function renderPage(options: PageOptions): string {
  const description =
    options.description === undefined
      ? ""
      : `<meta name="description" content="${escapeHtml(options.description)}">\n`;
  const nav = NAV_ITEMS.map((item) => {
    const current = item.href === options.path ? ' aria-current="page"' : "";

    return `      <a href="${item.href}"${current}>${item.label}</a>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${description}<link rel="icon" href="data:,">
<title>${escapeHtml(options.title)}</title>
<style>${DESIGN_SYSTEM_CSS}</style>
${options.script ?? ""}</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__inner">
    <a class="brand" href="/"><span class="brand__mark" aria-hidden="true">P/</span><span>Principled</span></a>
    <nav class="topnav" aria-label="Primary">
${nav}
    </nav>
  </div>
</header>
<main class="${options.mainClass ?? "page"}" id="main">
${options.body}
</main>
<footer class="footer">${FOOTER}</footer>
</body>
</html>`;
}
