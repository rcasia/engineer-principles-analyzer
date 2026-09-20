import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Principle } from "@principled/core";
import { EMPTY_STATE, PrinciplesList } from "./principles-list.tsx";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };
const ci: Principle = { id: "ci", title: "Continuous Integration" };

function render(principles: readonly Principle[]): string {
  return renderToStaticMarkup(<PrinciplesList principles={principles} />);
}

describe("EMPTY_STATE", () => {
  it("stays the sentence the page asserts literally", () => {
    expect(EMPTY_STATE).toBe("No principles are defined yet.");
  });
});

describe("PrinciplesList", () => {
  it("shows an empty state with no list when there are no principles", () => {
    const html = render([]);

    expect(html).toContain('<div class="empty-state">');
    expect(html).toContain("<strong>Catalog is empty</strong>");
    expect(html).toContain("<p>No principles are defined yet.</p>");
    expect(html).not.toContain("<ul");
  });

  it("renders principles as a labelled list", () => {
    const html = render([tdd, ci]);

    expect(html).toContain(
      '<ul aria-label="Engineering principles" class="principles-list">',
    );
    expect(html).toContain(
      '<li class="principle"><h2>Test Driven Development</h2><p>tdd</p></li>',
    );
    expect(html).toContain(
      '<li class="principle"><h2>Continuous Integration</h2><p>ci</p></li>',
    );
    expect(html).not.toContain("No principles are defined yet.");
  });

  it("escapes principle content", () => {
    const html = render([
      { id: "<id>", title: "<script>alert(1)</script>" },
    ]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;id&gt;");
    expect(html).not.toContain("<script>");
  });

  it("encodes apostrophes, which the old string template left raw", () => {
    const html = render([{ id: "obrien", title: "O'Brien's rule" }]);

    expect(html).toContain("O&#x27;Brien&#x27;s rule");
  });

  it("renders static markup with no client script", () => {
    expect(render([tdd])).not.toContain("<script");
    expect(render([])).not.toContain("<script");
  });
});
