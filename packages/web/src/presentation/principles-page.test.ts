import { describe, expect, it } from "bun:test";
import type { Principle } from "@epa/core";
import { escapeHtml, renderPrinciplesPage } from "./principles-page.ts";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };
const ci: Principle = { id: "ci", title: "Continuous Integration" };

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
    expect(html).toContain("<title>Engineer Principles Analyzer</title>");
  });

  it("wraps content in a main landmark with a single level one heading", () => {
    const html = renderPrinciplesPage([tdd]);

    expect(html).toContain('<main class="page" id="main">');
    expect(html).toContain("<h1>Engineer Principles Analyzer</h1>");
    expect(html.match(/<h1>/g)).toHaveLength(1);
  });

  it("lets keyboard users bypass navigation", () => {
    expect(renderPrinciplesPage([])).toContain(
      '<a class="skip-link" href="#main">Skip to content</a>',
    );
  });

  it("shows an empty state when there are no principles", () => {
    const html = renderPrinciplesPage([]);

    expect(html).toContain("<p>No principles are defined yet.</p>");
    expect(html).not.toContain("<ul");
  });

  it("renders principles as a labelled list", () => {
    const html = renderPrinciplesPage([tdd, ci]);

    expect(html).toContain(
      '<ul aria-label="Engineering principles" class="principles-list">',
    );
    expect(html).toContain("<h2>Test Driven Development</h2><p>tdd</p>");
    expect(html).toContain("<h2>Continuous Integration</h2><p>ci</p>");
    expect(html).toContain("</li><li");
    expect(html).not.toContain("No principles are defined yet.");
  });

  it("escapes principle content", () => {
    const html = renderPrinciplesPage([
      { id: "<id>", title: "<script>alert(1)</script>" },
    ]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;id&gt;");
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
});
