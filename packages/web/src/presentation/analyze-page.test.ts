import { describe, expect, it } from "bun:test";
import {
  AnalysisResult,
  Confidence,
  Evidence,
  SourceLocation,
  unwrap,
} from "@principled/core";
import type { AnalysisStatus } from "@principled/core";
import {
  ANALYZE_PAGE_TITLE,
  DEFAULT_LANGUAGE,
  NO_FINDINGS_MESSAGE,
  renderAnalyzePage,
  type AnalyzeView,
} from "./analyze-page.ts";

const analyzer = { name: "fake-analyzer", version: "0.0.0" };

function resultFor(overrides: {
  ruleId?: string;
  status?: AnalysisStatus;
  confidence?: number;
  method?: "deterministic" | "heuristic" | "ai_assisted";
  explanation?: string;
  evidence?: readonly Evidence[];
  remediation?: string;
  limitations?: readonly string[];
  humanReviewRecommended?: boolean;
}): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: overrides.ruleId ?? "solid.srp",
      status: overrides.status ?? "compliant",
      confidence: unwrap(Confidence.of(overrides.confidence ?? 1)),
      method: overrides.method ?? "deterministic",
      evidence: overrides.evidence ?? [],
      explanation: overrides.explanation ?? "Looks fine.",
      language: "typescript",
      analyzer,
      humanReviewRecommended:
        overrides.humanReviewRecommended ??
        (overrides.status === "uncertain" ? true : false),
      ...(overrides.remediation !== undefined
        ? { remediation: overrides.remediation }
        : {}),
      ...(overrides.limitations !== undefined
        ? { limitations: overrides.limitations }
        : {}),
    }),
  );
}

/** Slices out just the `<form>` element, so CSS selectors elsewhere on the page (e.g. `.textarea[aria-invalid="true"]`) cannot cause a false match. */
function formSectionOf(html: string): string {
  return html.slice(html.indexOf("<form"), html.indexOf("</form>"));
}

describe("renderAnalyzePage", () => {
  describe("the shared page shell", () => {
    it("declares a doctype, language and title", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toStartWith("<!doctype html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("<title>Analyze | Principled</title>");
      expect(ANALYZE_PAGE_TITLE).toBe("Analyze | Principled");
    });

    it("marks Analyze as the current page in the primary nav", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toContain('<a href="/analyze" aria-current="page">Analyze</a>');
    });

    it("lets keyboard users bypass navigation", () => {
      expect(renderAnalyzePage({ kind: "form" })).toContain(
        '<a class="skip-link" href="#main">Skip to content</a>',
      );
    });

    it("wraps content in a single main landmark with one h1", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toContain('<main class="page" id="main">');
      expect(html.match(/<h1>/g)).toHaveLength(1);
    });

    it("throws for an AnalyzeView kind it does not recognise", () => {
      expect(() =>
        renderAnalyzePage({ kind: "bogus" } as unknown as AnalyzeView),
      ).toThrow('Unknown AnalyzeView kind: {"kind":"bogus"}');
    });

    it("never renders a script tag", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({})],
      });

      expect(html).not.toContain("<script");
    });

    it("shows the web version in the footer", () => {
      expect(renderAnalyzePage({ kind: "form" })).toContain(
        '<footer class="footer">Principled · evidence before opinion · v0.0.0-dev</footer>',
      );
    });
  });

  describe("the blank form", () => {
    it("renders an empty textarea and the default language", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toContain('<h1>Analyze a source file</h1>');
      expect(html).toContain(
        '<textarea class="textarea" id="sourceCode" name="sourceCode" rows="16" spellcheck="false" placeholder="Paste exactly one source file"></textarea>',
      );
      expect(html).toContain('value="typescript"');
      expect(DEFAULT_LANGUAGE).toBe("typescript");
    });

    it("does not mark the textarea invalid", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(formSectionOf(html)).not.toContain("aria-invalid");
    });

    it("accepts a single file, not multiple", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toContain(
        '<input class="input" id="sourceFile" name="sourceFile" type="file">',
      );
      expect(html).not.toContain("multiple");
    });

    it("posts to /analyze as multipart form data", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).toContain(
        '<form method="post" action="/analyze" enctype="multipart/form-data"',
      );
    });

    it("shows no error banner", () => {
      const html = renderAnalyzePage({ kind: "form" });

      expect(html).not.toContain('role="alert"');
    });
  });

  describe("an invalid submission", () => {
    const view: AnalyzeView = {
      kind: "invalid",
      message: "sourceCode must not be empty.",
      sourceCode: "",
      language: "typescript",
    };

    it("shows the validation message in an alert", () => {
      const html = renderAnalyzePage(view);

      expect(html).toContain(
        '<div class="field__error" role="alert">sourceCode must not be empty.</div>',
      );
    });

    it("marks the textarea invalid", () => {
      const html = renderAnalyzePage(view);

      expect(formSectionOf(html)).toContain('aria-invalid="true"');
    });

    it("echoes back what the visitor submitted", () => {
      const html = renderAnalyzePage({
        kind: "invalid",
        message: "language must not be empty.",
        sourceCode: "class Foo {}",
        language: "",
      });

      expect(html).toContain(">class Foo {}</textarea>");
    });

    it("escapes echoed source and the error message", () => {
      const html = renderAnalyzePage({
        kind: "invalid",
        message: "<script>steal()</script>",
        sourceCode: "<script>alert(1)</script>",
        language: "typescript",
      });

      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).not.toContain("<script>steal()</script>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("&lt;script&gt;steal()&lt;/script&gt;");
    });
  });

  describe("completed results", () => {
    it("shows an empty state when no rules produced a finding", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).toContain(
        "The analysis completed, but no rules were available to evaluate this submission.",
      );
      expect(NO_FINDINGS_MESSAGE).toBe(
        "The analysis completed, but no rules were available to evaluate this submission.",
      );
      expect(html).not.toContain("<ol");
    });

    it("lists one entry per finding", () => {
      const violationEvidence = [
        unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ startLine: 1 })),
            excerpt: "class Foo {}",
          }),
        ),
      ];
      const html = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({ ruleId: "solid.srp" }),
          resultFor({
            ruleId: "solid.ocp",
            status: "violation",
            evidence: violationEvidence,
          }),
        ],
      });

      expect(html).toContain(
        '<ol aria-label="Analysis findings" class="findings-list">',
      );
      expect(html.match(/<article class="panel finding"/g)).toHaveLength(2);
      expect(html).toContain('id="finding-0-heading"');
      expect(html).toContain('id="finding-1-heading"');
      // Proves the findings are joined with no separator between them.
      expect(html).toContain("</li><li>\n<article");
    });

    it("offers a link back to analyze another file", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).toContain('<a class="button" href="/analyze">Analyze another file</a>');
    });

    it.each<[AnalysisStatus, string, string]>([
      ["compliant", "badge--success", "Compliant"],
      ["violation", "badge--error", "Violation"],
      ["uncertain", "badge--warning", "Uncertain"],
      ["not_applicable", "badge--info", "Not applicable"],
      ["unable_to_analyze", "badge--error", "Unable to analyze"],
    ])(
      "renders %p with the %p badge labelled %p",
      (status, badgeClass, label) => {
        const evidence =
          status === "violation"
            ? [
                unwrap(
                  Evidence.of({
                    location: unwrap(SourceLocation.of({ startLine: 1 })),
                    excerpt: "class Foo {}",
                  }),
                ),
              ]
            : [];
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status, evidence })],
        });

        expect(html).toContain(`<span class="badge ${badgeClass}">${label}</span>`);
      },
    );

    it("rounds confidence to a whole-number percentage", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({ confidence: 0, method: "heuristic" })],
      });

      expect(html).toContain(">0% confidence<");
    });

    it("shows a human review badge only when the result recommends it", () => {
      const withReview = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({
            status: "uncertain",
            confidence: 0.5,
            method: "heuristic",
            humanReviewRecommended: true,
          }),
        ],
      });
      const withoutReview = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({ humanReviewRecommended: false })],
      });

      expect(withReview).toContain(
        '<span class="badge badge--warning">Human review recommended</span>',
      );
      expect(withoutReview).not.toContain("Human review recommended");
    });

    it("escapes the rule id, explanation and method", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({
            ruleId: "<rule>",
            explanation: "<script>bad</script>",
          }),
        ],
      });

      expect(html).toContain("&lt;rule&gt;");
      expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
      expect(html).not.toContain("<script>bad</script>");
    });

    describe("evidence", () => {
      it("renders nothing when there is no evidence", () => {
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ evidence: [] })],
        });

        expect(html).not.toContain("Evidence");
      });

      it("shows the excerpt and a single-line location", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ startLine: 12 })),
            excerpt: "class Foo {}",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain("<h4>Evidence</h4>");
        expect(html).toContain("Line 12");
        expect(html).toContain("<code>class Foo {}</code>");
      });

      it("shows a line range when start and end lines differ", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(
              SourceLocation.of({ startLine: 5, endLine: 8 }),
            ),
            excerpt: "class Foo {\n  bar() {}\n}",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain("Lines 5\u20138");
      });

      it("shows the column when one is given", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(
              SourceLocation.of({ startLine: 3, startColumn: 7 }),
            ),
            excerpt: "x",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain("Line 3, column 7");
      });

      it("does not print a file path for a single-file web submission", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ startLine: 1 })),
            excerpt: "x",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain('<p class="type-mono">Line 1</p>');
      });

      it("shows and escapes a file path when a rule provides one", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(
              SourceLocation.of({
                filePath: "<danger>.ts",
                startLine: 1,
              }),
            ),
            excerpt: "x",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain("&lt;danger&gt;.ts \u00b7 Line 1");
      });

      it("escapes the excerpt", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ startLine: 1 })),
            excerpt: "<script>alert(1)</script>",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(html).not.toContain("<script>alert(1)</script>");
      });

      it("renders one item per piece of evidence", () => {
        const evidence = [
          unwrap(
            Evidence.of({
              location: unwrap(SourceLocation.of({ startLine: 1 })),
              excerpt: "one",
            }),
          ),
          unwrap(
            Evidence.of({
              location: unwrap(SourceLocation.of({ startLine: 2 })),
              excerpt: "two",
            }),
          ),
        ];
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence })],
        });

        expect(html.match(/<li class="finding-evidence">/g)).toHaveLength(2);
        // Proves the evidence items are joined with no separator between them.
        expect(html).toContain("</li><li class=\"finding-evidence\">");
      });

      it("renders exactly the excerpt and location markup for a single item, nothing else", () => {
        const evidence = unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ startLine: 1 })),
            excerpt: "one",
          }),
        );
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({ status: "violation", evidence: [evidence] })],
        });

        expect(html).toContain(
          '<div><h4>Evidence</h4><ul class="finding-evidence-list"><li class="finding-evidence"><p class="type-mono">Line 1</p><div class="code-block"><pre><code>one</code></pre></div></li></ul></div>',
        );
      });
    });

    describe("remediation", () => {
      it("is omitted when the result has none", () => {
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({})],
        });

        expect(html).not.toContain("Suggested fix");
      });

      it("is shown and escaped when present", () => {
        const html = renderAnalyzePage({
          kind: "completed",
          results: [
            resultFor({ remediation: "<b>Split this class</b>" }),
          ],
        });

        expect(html).toContain(
          "<strong>Suggested fix:</strong> &lt;b&gt;Split this class&lt;/b&gt;",
        );
      });
    });

    describe("limitations", () => {
      it("are omitted when the result has none", () => {
        const html = renderAnalyzePage({
          kind: "completed",
          results: [resultFor({})],
        });
        const findings = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));

        expect(findings).not.toContain("field__help");
      });

      it("are listed and escaped when present", () => {
        const html = renderAnalyzePage({
          kind: "completed",
          results: [
            resultFor({ limitations: ["<i>Limited context</i>", "Second"] }),
          ],
        });

        expect(html).toContain(
          '<ul class="field__help"><li>&lt;i&gt;Limited context&lt;/i&gt;</li><li>Second</li></ul>',
        );
      });
    });

    it("renders exactly the expected markup for a finding with no evidence, remediation or limitations", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({})],
      });

      const start = html.indexOf("<ol");
      const end = html.indexOf("</ol>") + "</ol>".length;
      const normalized = html.slice(start, end).replace(/\s+/g, " ").trim();

      expect(normalized).toBe(
        '<ol aria-label="Analysis findings" class="findings-list"><li> <article class="panel finding" aria-labelledby="finding-0-heading"> <div class="status-row"> <span class="badge badge--success">Compliant</span> <span class="badge">deterministic</span> <span class="badge">100% confidence</span> </div> <h3 id="finding-0-heading" class="card-title">solid.srp</h3> <p class="card-copy">Looks fine.</p> </article> </li></ol>',
      );
    });
  });
});
