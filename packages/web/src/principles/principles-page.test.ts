import { describe, expect, it } from "bun:test";
import type { Principle } from "@principled/core";
import { escapeHtml, renderPrinciplesPage } from "./principles-page.ts";

const tdd: Principle = {
  id: "tdd",
  title: "Test Driven Development",
  summary: "Write the failing test before the implementation.",
  whyItMatters: "Without it, untested paths accumulate silently.",
  howChecked: "Not checked by the analyzer; a catalog placeholder.",
  fixDirection: "Add the missing test first, then make it pass.",
};
const ci: Principle = {
  id: "ci",
  title: "Continuous Integration",
  summary: "Merge every change to main daily.",
  whyItMatters: "Long-lived branches hide integration risk.",
  howChecked: "Not checked by the analyzer; a catalog placeholder.",
  fixDirection: "Integrate the branch and run the checks.",
};

describe("escapeHtml", () => {
  it.each([
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ['"', "&quot;"],
  ])("escapes %p as %p", (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });

  it("escapes every occurrence, not just the first", () => {
    expect(escapeHtml("<<")).toBe("&lt;&lt;");
  });

  it("escapes ampersands first so entities are not double encoded", () => {
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Continuous Integration")).toBe(
      "Continuous Integration",
    );
  });
});

describe("renderPrinciplesPage", () => {
  it("declares a doctype and the page language", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('<html lang="en">');
  });

  it("sets a charset, a viewport and a title", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("<title>Principles | Principled</title>");
  });

  it("wraps content in a main landmark with a single level one heading", () => {
    const html = renderPrinciplesPage([tdd]);

    expect(html).toContain('<main class="page" id="main">');
    expect(html).toContain("<h1>Principles</h1>");
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });

  it("marks Principles as the current page in the primary nav", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain(
      '<a href="/principles" aria-current="page">Principles</a>',
    );
    expect(html.match(/<a\b[^>]*aria-current="page"/g)).toHaveLength(1);
  });

  it("lets keyboard users bypass navigation", () => {
    expect(renderPrinciplesPage([])).toContain(
      '<a class="skip-link" href="#main">Skip to content</a>',
    );
  });

  it("shows an empty state when there are no principles", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain("<strong>Catalog is being drafted</strong>");
    expect(html).toContain("<p>The standards behind the rules that already run");
    expect(html).not.toContain("<ul");
  });

  it("explains the principle → rule → finding chain that gives the page its purpose", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain(
      '<ol class="principles__flow" aria-label="How principles become findings">',
    );
    expect(html).toContain(
      "<h2>Principle</h2>\n    <p>The standard, written down: what it guards and why it matters.</p>",
    );
    expect(html).toContain(
      "<h2>Rule</h2>\n    <p>The principle's checkable form, run against submitted code.</p>",
    );
    expect(html).toContain(
      "<h2>Finding</h2>\n    <p>The result of the rule: verdict, evidence and confidence, naming its principle.</p>",
    );
  });

  it("renders principles as a labelled list", () => {
    const html = renderPrinciplesPage([tdd, ci]);

    expect(html).toContain(
      '<ul aria-label="Engineering principles" class="principles-list">',
    );
    expect(html).toContain("Test Driven Development");
    expect(html).toContain("Write the failing test before the implementation.");
    expect(html).toContain("Continuous Integration");
    expect(html).toContain("Merge every change to main daily.");
    expect(html).toContain("Why it matters");
    expect(html).toContain("How Principled checks it");
    expect(html).not.toContain("Catalog is being drafted");
  });

  it("links the catalog to the analyzer", () => {
    const html = renderPrinciplesPage([tdd]);

    expect(html).toContain(
      '<a class="button button--primary" href="/analyze">Analyze a file against these principles →</a>',
    );
    expect(renderPrinciplesPage([])).not.toContain("/analyze\">Analyze a file");
    expect(renderPrinciplesPage([])).not.toContain('<p class="principles__cta">');
    expect(renderPrinciplesPage([])).toContain("</div>\n</main>");
  });

  it("escapes principle content", () => {
    const html = renderPrinciplesPage([
      {
        id: "<id>",
        title: "<script>alert(1)</script>",
        summary: "<b>bold</b>",
        whyItMatters: "<i>why</i>",
        howChecked: "<u>how</u>",
        fixDirection: "<em>fix</em>",
      },
    ]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;id&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).not.toContain("<script>");
  });

  it("respects reduced motion and both colour schemes", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("color-scheme: light dark");
  });

  it("gives keyboard users a visible focus indicator", () => {
    expect(renderPrinciplesPage([])).toContain(":focus-visible");
  });

  it("shows the web version in the footer", () => {
    expect(renderPrinciplesPage([])).toContain(
      '<footer class="footer">\n  <span>Principled · evidence before opinion · v0.0.0-dev</span>',
    );
  });

  it("ships no client script, so scripting-disabled output is the output", () => {
    expect(renderPrinciplesPage([tdd])).not.toContain("<script");
    expect(renderPrinciplesPage([])).not.toContain("<script");
  });

  it("encodes apostrophes through the component's stricter escaping", () => {
    const html = renderPrinciplesPage([
      {
        id: "obrien",
        title: "O'Brien's rule",
        summary: "It's summarised",
        whyItMatters: "It's why",
        howChecked: "It's how",
        fixDirection: "It's the fix",
      },
    ]);

    expect(html).toContain("O&#x27;Brien&#x27;s rule");
  });
});
