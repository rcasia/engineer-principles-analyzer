import { describe, expect, it } from "bun:test";
import type { PlainResult } from "../analysis-payload.ts";
import { renderAnalyzePage } from "../analyze-page.ts";
import {
  renderLiveAnalyzing,
  renderLiveEmpty,
  renderLiveError,
  renderLiveFindings,
} from "./live-findings.ts";

function plainFor(overrides?: Partial<PlainResult>): PlainResult {
  return {
    ruleId: "solid.srp",
    status: "compliant",
    confidence: 1,
    method: "deterministic",
    evidence: [],
    explanation: "Looks fine.",
    language: "typescript",
    analyzer: { name: "fake-analyzer", version: "0.0.0" },
    limitations: [],
    humanReviewRecommended: false,
    ...overrides,
  };
}

describe("renderLiveFindings", () => {
  it("shows the empty-run state when no rule produced a finding", () => {
    const html = renderLiveFindings([]);

    expect(html).toBe(
      '<div class="empty-state"><strong>No findings</strong><p>The analysis completed, but no rules were available to evaluate this submission.</p></div>',
    );
  });

  it("lists one entry per finding with sequential headings", () => {
    const html = renderLiveFindings([
      plainFor({ ruleId: "solid.srp" }),
      plainFor({
        ruleId: "solid.ocp",
        status: "violation",
        evidence: [
          {
            location: { startLine: 1, endLine: 1 },
            excerpt: "class Foo {}",
          },
        ],
      }),
    ]);

    expect(html).toContain(
      '<ol aria-label="Analysis findings" class="findings-list">',
    );
    expect(html.match(/<article class="panel finding"/g)).toHaveLength(2);
    expect(html).toContain('id="finding-0-heading"');
    expect(html).toContain('id="finding-1-heading"');
    expect(html).toContain("</li><li>\n<article");
  });

  it.each([
    ["compliant", "badge--success", "Compliant"],
    ["violation", "badge--error", "Violation"],
    ["uncertain", "badge--warning", "Uncertain"],
    ["not_applicable", "badge--info", "Not applicable"],
    ["unable_to_analyze", "badge--error", "Unable to analyze"],
  ])("renders %p with the %p badge labelled %p", (status, badge, label) => {
    const html = renderLiveFindings([
      plainFor({
        status,
        evidence:
          status === "violation"
            ? [{ location: { startLine: 1, endLine: 1 }, excerpt: "x" }]
            : [],
      }),
    ]);

    expect(html).toContain(`<span class="badge ${badge}">${label}</span>`);
  });

  it("falls back to an info badge and the raw status for an unknown verdict", () => {
    const html = renderLiveFindings([plainFor({ status: "mystery" })]);

    expect(html).toContain('<span class="badge badge--info">mystery</span>');
    expect(html).toContain(
      '<p class="results-summary">1 finding: 1 mystery</p>',
    );
  });

  it("rounds confidence to a whole-number percentage", () => {
    expect(renderLiveFindings([plainFor({ confidence: 0 })])).toContain(
      ">0% confidence<",
    );
    expect(
      renderLiveFindings([
        plainFor({ confidence: 0.756, method: "heuristic" }),
      ]),
    ).toContain(">76% confidence<");
  });

  it("shows a human review badge only when the result recommends it", () => {
    expect(
      renderLiveFindings([
        plainFor({
          status: "uncertain",
          confidence: 0.5,
          method: "heuristic",
          humanReviewRecommended: true,
        }),
      ]),
    ).toContain(
      '<span class="badge badge--warning">Human review recommended</span>',
    );
    expect(
      renderLiveFindings([plainFor({ humanReviewRecommended: false })]),
    ).not.toContain("Human review recommended");
  });

  it("escapes the rule id, explanation and method", () => {
    const html = renderLiveFindings([
      plainFor({
        ruleId: "<rule>",
        explanation: "<script>bad</script>",
        method: "<heuristic>",
      }),
    ]);

    expect(html).toContain("&lt;rule&gt;");
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
    expect(html).toContain("&lt;heuristic&gt;");
    expect(html).not.toContain("<script>bad</script>");
  });

  it("escapes ampersands and quotes alongside angle brackets", () => {
    const html = renderLiveFindings([
      plainFor({ explanation: 'Fish & "chips" <yum>' }),
    ]);

    expect(html).toContain("Fish &amp; &quot;chips&quot; &lt;yum&gt;");
    expect(html).not.toContain('Fish & "chips"');
  });

  it("renders nothing extra when there is no evidence", () => {
    expect(renderLiveFindings([plainFor({})])).not.toContain("Evidence");
  });

  it("shows the excerpt and a single-line location", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          { location: { startLine: 12, endLine: 12 }, excerpt: "class Foo {}" },
        ],
      }),
    ]);

    expect(html).toContain("<h4>Evidence</h4>");
    expect(html).toContain("Line 12");
    expect(html).not.toContain("column");
    expect(html).toContain("<code>class Foo {}</code>");
  });

  it("shows a line range when start and end lines differ", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          {
            location: { startLine: 5, endLine: 8 },
            excerpt: "class Foo {\n  bar() {}\n}",
          },
        ],
      }),
    ]);

    expect(html).toContain("Lines 5–8");
  });

  it("shows the column when one is given", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          {
            location: { startLine: 3, endLine: 3, startColumn: 7 },
            excerpt: "x",
          },
        ],
      }),
    ]);

    expect(html).toContain("Line 3, column 7");
  });

  it("shows and escapes a file path when a rule provides one", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          {
            location: {
              startLine: 1,
              endLine: 1,
              filePath: "<danger>.ts",
            },
            excerpt: "x",
          },
        ],
      }),
    ]);

    expect(html).toContain("&lt;danger&gt;.ts · Line 1");
  });

  it("escapes the excerpt", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          {
            location: { startLine: 1, endLine: 1 },
            excerpt: "<script>alert(1)</script>",
          },
        ],
      }),
    ]);

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renders one item per piece of evidence", () => {
    const html = renderLiveFindings([
      plainFor({
        status: "violation",
        evidence: [
          { location: { startLine: 1, endLine: 1 }, excerpt: "one" },
          { location: { startLine: 2, endLine: 2 }, excerpt: "two" },
        ],
      }),
    ]);

    expect(html.match(/<li class="finding-evidence">/g)).toHaveLength(2);
    expect(html).toContain('</li><li class="finding-evidence">');
  });

  it("is omitted when the result has no remediation", () => {
    expect(renderLiveFindings([plainFor({})])).not.toContain("Suggested fix");
  });

  it("shows and escapes the remediation when present", () => {
    expect(
      renderLiveFindings([plainFor({ remediation: "<b>Split it</b>" })]),
    ).toContain(
      "<strong>Suggested fix:</strong> &lt;b&gt;Split it&lt;/b&gt;",
    );
  });

  it("omits limitations when the result has none", () => {
    expect(
      renderLiveFindings([plainFor({})]).slice(
        renderLiveFindings([plainFor({})]).indexOf("<ol"),
      ),
    ).not.toContain("field__help");
  });

  it("lists and escapes limitations when present", () => {
    expect(
      renderLiveFindings([
        plainFor({ limitations: ["<i>Limited</i>", "Second"] }),
      ]),
    ).toContain(
      '<ul class="field__help"><li>&lt;i&gt;Limited&lt;/i&gt;</li><li>Second</li></ul>',
    );
  });

  it("attributes each finding to its analysed language and analyzer version", () => {
    expect(
      renderLiveFindings([
        plainFor({
          language: "python",
          analyzer: { name: "principled-solid-srp", version: "1" },
        }),
      ]),
    ).toContain(
      '<p class="finding-meta">Analyzed as Python · principled-solid-srp v1</p>',
    );
  });

  it("escapes the provenance fields", () => {
    const html = renderLiveFindings([
      plainFor({
        language: "go",
        analyzer: { name: "<analyzer>", version: "<version>" },
      }),
    ]);

    expect(html).toContain("Analyzed as Go · &lt;analyzer&gt; v&lt;version&gt;");
    expect(html).not.toContain("<analyzer>");
  });

  it("summarises mixed findings with per-status counts", () => {
    const html = renderLiveFindings([
      plainFor({ status: "compliant" }),
      plainFor({
        status: "violation",
        evidence: [{ location: { startLine: 1, endLine: 1 }, excerpt: "x" }],
      }),
      plainFor({
        status: "uncertain",
        confidence: 0.5,
        method: "heuristic",
        humanReviewRecommended: true,
      }),
    ]);

    expect(html).toContain(
      '<p class="results-summary">3 findings: 1 compliant · 1 violation · 1 uncertain</p>',
    );
  });

  it("uses the singular when exactly one finding exists", () => {
    expect(renderLiveFindings([plainFor({})])).toContain(
      '<p class="results-summary">1 finding: 1 compliant</p>',
    );
  });

  it("discloses the probabilistic nature of findings above the list", () => {
    const html = renderLiveFindings([plainFor({})]);

    expect(html).toContain(
      '<p class="results-note">Findings are heuristic or AI-assisted judgments, not compiler errors. Confirm before acting.</p>',
    );
    expect(html.indexOf("results-note")).toBeLessThan(
      html.indexOf('<ol aria-label="Analysis findings"'),
    );
  });

  it("renders exactly the expected markup for a bare finding", () => {
    const html = renderLiveFindings([plainFor({})]);
    const start = html.indexOf("<ol");
    const end = html.indexOf("</ol>") + "</ol>".length;
    const normalized = html.slice(start, end).replace(/\s+/g, " ").trim();

    expect(normalized).toBe(
      '<ol aria-label="Analysis findings" class="findings-list"><li> <article class="panel finding" aria-labelledby="finding-0-heading"> <div class="status-row"> <span class="badge badge--success">Compliant</span> <span class="badge">deterministic</span> <span class="badge">100% confidence</span> </div> <h3 id="finding-0-heading" class="card-title">solid.srp</h3> <p class="card-copy">Looks fine.</p> <p class="finding-meta">Analyzed as TypeScript · fake-analyzer v0.0.0</p> </article> </li></ol>',
    );
  });
});

describe("renderLiveEmpty", () => {
  it("matches the server-rendered empty state byte for byte", () => {
    const page = renderAnalyzePage({
      kind: "form",
      sourceCode: "",
      language: "",
      exampleId: null,
    });

    expect(page).toContain(renderLiveEmpty());
    expect(renderLiveEmpty()).toBe(
      '<div class="empty-state"><strong>No findings yet</strong><p>Findings appear here as you type — paste code, upload a file, or try an example.</p></div>',
    );
  });
});

describe("renderLiveError", () => {
  it("shows the message in a notice, escaped", () => {
    const html = renderLiveError("<b>oops</b>");

    expect(html).toBe(
      '<div class="notice"><p>&lt;b&gt;oops&lt;/b&gt;</p></div>',
    );
  });
});

describe("renderLiveAnalyzing", () => {
  it("shows skeleton cards and a progress line, hidden from assistive tech", () => {
    const html = renderLiveAnalyzing();

    expect(html).toContain('<div class="state" aria-hidden="true">');
    expect(html).toContain('<div class="skeleton">');
    expect(html).toContain('<div class="progress-line">');
  });
});
