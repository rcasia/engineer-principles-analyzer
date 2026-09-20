import { describe, expect, it } from "bun:test";
import {
  LANDING_PAGE_DESCRIPTION,
  LANDING_PAGE_TITLE,
  renderLandingPage,
} from "./landing-page.ts";

describe("renderLandingPage", () => {
  it("names the product and describes it for search and link unfurling", () => {
    const html = renderLandingPage();

    expect(LANDING_PAGE_TITLE).toBe("Principled");
    expect(html).toContain("<title>Principled</title>");
    expect(LANDING_PAGE_DESCRIPTION).toBe(
      "Principled evaluates source code against explicit engineering principles and returns evidence-backed findings — judgments you can check, not just trust.",
    );
    expect(html).toContain(
      '<meta name="description" content="Principled evaluates source code against explicit engineering principles and returns evidence-backed findings — judgments you can check, not just trust.">',
    );
  });

  it("states the product proposition in the first screen", () => {
    const html = renderLandingPage();

    expect(html).toContain(
      '<p class="eyebrow">Engineering judgment, made explicit</p>',
    );
    expect(html).toContain(
      "<h1>Code review arguments, written down and checked.</h1>",
    );
    expect(html).toContain(
      '<p class="lede">Principled evaluates source code against explicit engineering principles — dependency direction, single responsibility, interface design — and returns structured findings: a judgment, the code evidence behind it, and how much to trust it. It does not replace compilers, linters or tests; it covers the design questions they cannot answer.</p>',
    );
  });

  it("leads into the analyze experience from the hero", () => {
    const hero = renderLandingPage().slice(
      0,
      renderLandingPage().indexOf('<section class="section"'),
    );

    expect(hero).toContain(
      '<a class="button button--primary" href="/analyze">Analyze a file →</a>',
    );
    expect(hero).toContain(
      '<a class="button" href="/principles">Read the principles</a>',
    );
  });

  it("states the honest facts of what exists today", () => {
    const html = renderLandingPage();

    expect(html).toContain("<div><dt>Checks</dt><dd>structure, not style</dd></div>");
    expect(html).toContain("<div><dt>Rules today</dt><dd>5 SOLID heuristics</dd></div>");
    expect(html).toContain("<div><dt>Web scope</dt><dd>single files</dd></div>");
    expect(html).toContain("<div><dt>Submissions</dt><dd>never stored</dd></div>");
  });

  it("explains how the tool complements deterministic engineering tools", () => {
    const html = renderLandingPage();

    expect(html).toContain(
      '<p class="section__description">Compilers say whether code builds. Linters say whether it breaks a rule with a known answer. Tests say whether behavior matches expectations. Whether the design is sound is still argued in review, as opinion — Principled exists for that argument, so it complements those tools instead of competing with them.</p>',
    );
    expect(html).toContain(
      "<p class=\"panel__label\">What deterministic tools answer</p>",
    );
    expect(html).toContain(
      "<p class=\"panel__label\">What design review answers</p>",
    );
  });

  it("walks the workflow narrative: principles to findings, in four steps", () => {
    const html = renderLandingPage();

    expect(html).toContain(
      "<h2 id=\"how-heading\">From principle to finding, in four steps</h2>",
    );
    expect(html).toContain(
      "<p class=\"panel__label\">Step 01</p>\n  <h3 class=\"card-title\">Principles</h3>",
    );
    expect(html).toContain(
      "<p class=\"panel__label\">Step 02</p>\n  <h3 class=\"card-title\">Semantic analysis</h3>",
    );
    expect(html).toContain(
      "<p class=\"panel__label\">Step 03</p>\n  <h3 class=\"card-title\">Evidence + judgment</h3>",
    );
    expect(html).toContain(
      "<p class=\"panel__label\">Step 04</p>\n  <h3 class=\"card-title\">Actionable finding</h3>",
    );
    expect(html.match(/class="panel__label">Step 0/g)).toHaveLength(4);
  });

  it("labels the sample finding as illustrative, not a claim of accuracy", () => {
    const html = renderLandingPage();

    expect(html).toContain(
      '<p class="panel__label">Illustrative finding</p>',
    );
    expect(html).toContain('<span class="badge badge--error">Violation</span>');
    expect(html).toContain(
      '<p class="playground__note">Findings are judgments with visible evidence, not build failures — confirm before acting. v0.0.0-dev</p>',
    );
    expect(html).not.toContain("accuracy");
  });

  it("invites the visitor to try the analyzer on a real file", () => {
    const html = renderLandingPage();

    expect(html).toContain(
      '<h2 id="try-heading">Run it on a file you know</h2>',
    );
    expect(html).toContain(
      '<a class="button button--primary" href="/analyze">Open the analyzer →</a>',
    );
    expect(html).toContain(
      '<a class="button button--quiet" href="/principles">How principles work</a>',
    );
  });

  it("keeps the shared chrome: one h1, skip link, current nav and no script", () => {
    const html = renderLandingPage();

    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<a class="skip-link" href="#main">Skip to content</a>');
    expect(html).toContain('<main class="playground" id="main">');
    expect(html).toContain(
      '<footer class="footer">Principled · evidence before opinion · v0.0.0-dev</footer>',
    );
    expect(html).not.toMatch(/<a\b[^>]*aria-current/);
    expect(html).not.toContain("<script");
  });

  it("is fully keyboard and screen-reader reachable: landmarks and headings", () => {
    const html = renderLandingPage();

    expect(html).toContain('<nav class="topnav" aria-label="Primary">');
    expect(html).toContain('<section class="section" aria-labelledby="gap-heading">');
    expect(html).toContain('<section class="section" aria-labelledby="how-heading">');
    expect(html).toContain('<section class="section" aria-labelledby="try-heading">');
  });
});
