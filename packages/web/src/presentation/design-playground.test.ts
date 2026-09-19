import { describe, expect, it } from "bun:test";
import { renderDesignPlayground } from "./design-playground.ts";

describe("renderDesignPlayground", () => {
  it("renders a standalone, accessible design reference", () => {
    const html = renderDesignPlayground();

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Design playground | Principled</title>");
    expect(html).toContain('<a class="skip-link" href="#main">Skip to content</a>');
    expect(html).toContain('<main class="playground" id="main">');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).not.toContain("<script");
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

  it("shows the web version in the footer", () => {
    const html = renderDesignPlayground();

    expect(html).toContain("responsive · v0.0.0-dev</footer>");
  });
});
