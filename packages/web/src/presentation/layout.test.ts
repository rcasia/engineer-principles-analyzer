import { describe, expect, it } from "bun:test";
import { escapeHtml, FOOTER, NAV_ITEMS, renderPage } from "./layout.ts";
import { VERSION } from "../version.ts";

const body = `<h1>Test page</h1>`;

function navOf(html: string): string {
  const start = html.indexOf('<nav class="topnav"');
  return html.slice(start, html.indexOf("</nav>", start) + "</nav>".length);
}

describe("escapeHtml", () => {
  it("escapes the four HTML-significant characters layout needs", () => {
    expect(escapeHtml(`& < > "`)).toBe("&amp; &lt; &gt; &quot;");
  });
});

describe("NAV_ITEMS", () => {
  it("is the product's primary navigation", () => {
    expect(NAV_ITEMS).toEqual([
      { href: "/", label: "Home" },
      { href: "/principles", label: "Principles" },
      { href: "/analyze", label: "Analyze" },
      { href: "/design", label: "Design system" },
    ]);
  });
});

describe("FOOTER", () => {
  it("carries the tagline and the web version", () => {
    expect(FOOTER).toBe(`Principled · evidence before opinion · v${VERSION}`);
  });
});

describe("renderPage", () => {
  it("renders the full document around the body", () => {
    const html = renderPage({ title: "Principled", path: "/", body });

    expect(html).toStartWith("<!doctype html>\n<html lang=\"en\">");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<link rel="icon" href="data:,">');
    expect(html).toContain("<title>Principled</title>");
    expect(html).toContain("<main class=\"page\" id=\"main\">\n<h1>Test page</h1>\n</main>");
    expect(html).toContain('<footer class="footer">Principled · evidence before opinion');
    expect(html).toEndWith("</body>\n</html>");
  });

  it("escapes the title, which may one day include user-controlled text", () => {
    expect(
      renderPage({
        title: `Rule <script>alert(1)</script> "x" & y`,
        path: "/",
        body,
      }),
    ).toContain(
      "<title>Rule &lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot; &amp; y</title>",
    );
  });

  it("renders the whole nav block, one item per line, only the path current", () => {
    expect(navOf(renderPage({ title: "Analyze", path: "/analyze", body }))).toBe(
      `<nav class="topnav" aria-label="Primary">
      <a href="/">Home</a>
      <a href="/principles">Principles</a>
      <a href="/analyze" aria-current="page">Analyze</a>
      <a href="/design">Design system</a>
    </nav>`,
    );
  });

  it("marks nothing current for a route outside the nav", () => {
    expect(
      navOf(renderPage({ title: "Results", path: "/done", body })),
    ).not.toContain("aria-current");
  });

  it("keeps the head free of stray text when no description is given", () => {
    expect(renderPage({ title: "T", path: "/", body })).toContain(
      '<meta name="color-scheme" content="light dark">\n<link rel="icon" href="data:,">',
    );
  });

  it("omits the description meta unless one is given, and escapes it", () => {
    expect(renderPage({ title: "T", path: "/", body })).not.toContain(
      'name="description"',
    );
    expect(renderPage({ title: "T", path: "/", body })).toContain(
      '<meta name="color-scheme" content="light dark">\n<link',
    );
    expect(
      renderPage({
        title: "T",
        description: `What & why`,
        path: "/",
        body,
      }),
    ).toContain('<meta name="description" content="What &amp; why">');
  });

  it("closes the head with nothing after the style when no script is given", () => {
    expect(renderPage({ title: "T", path: "/", body })).toContain(
      "</style>\n</head>",
    );
  });

  it("inserts a script before the head closes, on its own line", () => {
    const html = renderPage({
      title: "T",
      path: "/",
      body,
      script: '<script type="module" src="/assets/a.js"></script>\n',
    });

    expect(html).toContain(
      '</style>\n<script type="module" src="/assets/a.js"></script>\n</head>',
    );
  });

  it("uses the standard content width when asked for the playground", () => {
    expect(
      renderPage({ title: "T", path: "/", body, mainClass: "playground" }),
    ).toContain('<main class="playground" id="main">');
  });

  it("lets keyboard users bypass the navigation", () => {
    expect(renderPage({ title: "T", path: "/", body })).toContain(
      '<a class="skip-link" href="#main">Skip to content</a>',
    );
  });
});
