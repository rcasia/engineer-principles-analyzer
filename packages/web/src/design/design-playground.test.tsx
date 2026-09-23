import { describe, expect, it } from "bun:test";
import {
  DESIGN_PLAYGROUND_TITLE,
  renderDesignPlayground,
} from "./design-playground.tsx";

describe("renderDesignPlayground", () => {
  it("renders a standalone, accessible design reference", () => {
    const html = renderDesignPlayground();

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Design playground | Principled</title>");
    expect(DESIGN_PLAYGROUND_TITLE).toBe("Design playground | Principled");
    expect(html).toContain(
      '<a class="skip-link" href="#main">Skip to content</a>',
    );
    expect(html).toContain('<main class="playground" id="main">');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).not.toContain("<script");
  });

  it("ships no client script and no hydration artifacts", () => {
    const html = renderDesignPlayground();

    expect(html).not.toContain("<script");
    expect(html).not.toContain("data-react");
    expect(html).not.toContain("react-mount");
  });

  it("demonstrates the required interface vocabulary with developer content", () => {
    const html = renderDesignPlayground();

    expect(html).toContain("Type and color");
    expect(html).toContain("Actions and input");
    expect(html).toContain("Structured evidence");
    expect(html).toContain("Status and code");
    expect(html).toContain("Empty, loading and error");
    expect(html).toContain("Dependencies point inward");
    expect(html).toContain("Repository could not be read");
  });

  it("includes responsive themes and accessibility preferences", () => {
    const html = renderDesignPlayground();

    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("forced-colors: active");
    expect(html).toContain(":focus-visible");
    expect(html).toContain("@media (max-width: 44.99rem)");
  });

  it("sizes the editor gutter to its line numbers instead of a fixed column", () => {
    const html = renderDesignPlayground();

    expect(html).toContain(
      ".editor__body { display: grid; grid-template-columns: auto minmax(0, 1fr); }",
    );
    expect(html).toContain(".editor__gutter { min-width: 3.25rem;");
  });

  it("marks Design system as the only current page in the primary nav", () => {
    const html = renderDesignPlayground();

    expect(html).toContain(
      '<a href="/design" aria-current="page">Design system</a>',
    );
    const nav = html.slice(
      html.indexOf('<nav class="topnav"'),
      html.indexOf("</nav>") + "</nav>".length,
    );

    expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
    expect(nav).toContain('<a href="/">Home</a>');
  });

  it("shows the web version in the footer", () => {
    const html = renderDesignPlayground();

    expect(html).toContain("responsive · v0.0.0-dev</footer>");
  });

  it("paints every semantic swatch with its design token", () => {
    const html = renderDesignPlayground();

    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-text)"></span><span class="swatch__name">text</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-surface-subtle)"></span><span class="swatch__name">surface-subtle</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-accent)"></span><span class="swatch__name">accent</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-success)"></span><span class="swatch__name">success</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-warning)"></span><span class="swatch__name">warning</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-error)"></span><span class="swatch__name">error</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-info)"></span><span class="swatch__name">information</span>',
    );
    expect(html).toContain(
      '<span class="swatch__color" style="background:var(--color-border)"></span><span class="swatch__name">border</span>',
    );
  });

  it("constrains the search field to the measure used across the page", () => {
    const html = renderDesignPlayground();

    expect(html).toContain(
      '<div class="field" style="max-width:32rem;margin-bottom:1.5rem"><label for="search">Search evidence</label>',
    );
  });

  it("keeps the notice readable with spaces around the inline code", () => {
    const html = renderDesignPlayground();

    expect(html).toContain(
      "No branch was configured. Results are based on <code>main</code> at commit <code>9f8c2a1</code>.",
    );
  });

  it("renders the configuration sample byte-identically, whitespace included", () => {
    const html = renderDesignPlayground();
    const start = html.indexOf(
      '<pre aria-label="TypeScript configuration example">',
    );
    const end = html.indexOf("</pre>", start);
    const text = html
      .slice(start, end)
      .replace(/<[^>]+>/g, "");

    expect(text).toBe(
      'import { defineConfig } from &quot;principled&quot;;\n\nexport default defineConfig({\n  profile: &quot;strict&quot;,\n  include: [&quot;packages/*/src/**&quot;],\n  // Evidence remains inspectable in CI artifacts.\n  output: &quot;reports/principles.json&quot;,\n});',
    );
  });
});
