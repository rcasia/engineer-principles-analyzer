import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Principle } from "@principled/core";
import { EMPTY_STATE, PrinciplesList } from "./principles-list.tsx";

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

function render(principles: readonly Principle[]): string {
  return renderToStaticMarkup(<PrinciplesList principles={principles} />);
}

describe("EMPTY_STATE", () => {
  it("stays the sentence the page asserts literally", () => {
    expect(EMPTY_STATE).toBe(
      "The standards behind the rules that already run — like the SOLID checks in the analyzer — are written down here as they are drafted.",
    );
  });
});

describe("PrinciplesList", () => {
  it("shows an empty state with no list when there are no principles", () => {
    const html = render([]);

    expect(html).toContain('<div class="empty-state">');
    expect(html).toContain("<strong>Catalog is being drafted</strong>");
    expect(html).toContain(
      "<p>The standards behind the rules that already run",
    );
    expect(html).not.toContain("<ul");
  });

  it("renders principles as a labelled list", () => {
    const html = render([tdd, ci]);

    expect(html).toContain(
      '<ul aria-label="Engineering principles" class="principles-list">',
    );
    expect(html).toContain("Test Driven Development");
    expect(html).toContain("Write the failing test before the implementation.");
    expect(html).toContain("Without it, untested paths accumulate silently.");
    expect(html).toContain("Continuous Integration");
    expect(html).toContain("Merge every change to main daily.");
    expect(html).toContain("Why it matters");
    expect(html).toContain("How Principled checks it");
    expect(html).toContain("If you get a finding");
    expect(html).toContain('<a href="/analyze">Try it in the analyzer →</a>');
    expect(html).not.toContain("The standards behind the rules");
  });

  it("escapes principle content", () => {
    const html = render([
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
    expect(html).toContain("&lt;i&gt;why&lt;/i&gt;");
    expect(html).not.toContain("<script>");
  });

  it("encodes apostrophes, which the old string template left raw", () => {
    const html = render([
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

  it("links each card's article to its heading for assistive tech", () => {
    const html = render([tdd]);

    expect(html).toContain('aria-labelledby="tdd-title"');
    expect(html).toContain('id="tdd-title"');
  });

  it("renders static markup with no client script", () => {
    expect(render([tdd])).not.toContain("<script");
    expect(render([])).not.toContain("<script");
  });
});
