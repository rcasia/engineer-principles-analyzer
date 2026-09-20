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

  it("marks Design system as the current page in the primary nav", () => {
    expect(renderDesignPlayground()).toContain(
      '<a href="/design" aria-current="page">Design system</a>',
    );
  });

  it("shows the web version in the footer", () => {
    const html = renderDesignPlayground();

    expect(html).toContain("responsive · v0.0.0-dev</footer>");
  });
});
