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

/** Slices out just the `<form>` element, so markup elsewhere on the page cannot cause a false match. */
function formSectionOf(html: string): string {
  return html.slice(html.indexOf("<form"), html.indexOf("</form>"));
}

/** Slices out just the gutter `<div>`, so identical markup elsewhere (e.g. the navbar brand) cannot cause a false match. */
function gutterSectionOf(html: string): string {
  const start = html.indexOf('<div class="editor__gutter"');
  const end = html.indexOf("</div>", start);

  return html.slice(start, end);
}

function blankForm(): AnalyzeView {
  return {
    kind: "form",
    sourceCode: "",
    language: "typescript",
    exampleId: null,
  };
}

describe("renderAnalyzePage", () => {
  describe("the shared page shell", () => {
    it("declares a doctype, language and title", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toStartWith("<!doctype html>");
      expect(html).toContain('<html lang="en">');
      expect(html).toContain("<title>Analyze | Principled</title>");
      expect(ANALYZE_PAGE_TITLE).toBe("Analyze | Principled");
    });

    it("marks Analyze as the current page in the primary nav", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('<a href="/analyze" aria-current="page">Analyze</a>');
    });

    it("lets keyboard users bypass navigation", () => {
      expect(renderAnalyzePage(blankForm())).toContain(
        '<a class="skip-link" href="#main">Skip to content</a>',
      );
    });

    it("wraps content in a single main landmark with one h1", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('<main class="playground" id="main">');
      expect(html.match(/<h1>/g)).toHaveLength(1);
    });

    it("keeps completed findings at reading width", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).toContain('<main class="page" id="main">');
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
      expect(renderAnalyzePage(blankForm())).toContain(
        '<footer class="footer">Principled · evidence before opinion · v0.0.0-dev</footer>',
      );
    });
  });

  describe("the blank playground", () => {
    it("frames the page as testing code against a contract", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain("<h1>Analyze</h1>");
      expect(html).toContain(
        "<p class=\"lede\">Test your engineering principles against real code.</p>",
      );
      expect(html).not.toContain("Paste or submit exactly one file");
    });

    it("renders an empty editor with a derived filename and the default language", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('<span class="editor__filename">snippet.ts</span>');
      expect(html).toContain(
        '<textarea class="editor__input" id="sourceCode" name="sourceCode" rows="16" spellcheck="false" placeholder="Paste exactly one source file"></textarea>',
      );
      expect(html).toContain('value="typescript"');
      expect(DEFAULT_LANGUAGE).toBe("typescript");
    });

    it("numbers enough gutter lines to fill the empty editor", () => {
      const gutter = gutterSectionOf(renderAnalyzePage(blankForm()));

      expect(gutter).toStartWith(
        '<div class="editor__gutter" aria-hidden="true"><span>1</span>',
      );
      expect(gutter).toContain("</span><span>");
      expect(gutter).toContain("<span>24</span>");
      expect(gutter).not.toContain("<span>25</span>");
    });

    it("does not mark the editor invalid", () => {
      const html = renderAnalyzePage(blankForm());

      expect(formSectionOf(html)).not.toContain("aria-invalid");
      expect(formSectionOf(html)).not.toContain("aria-describedby");
    });

    it("hides the native file input behind a toolbar upload action, single file only", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain(
        '<label class="button" for="sourceFile" title="If a file is chosen it is used instead of the pasted text">Upload</label>',
      );
      expect(html).toContain(
        '<input class="visually-hidden" id="sourceFile" name="sourceFile" type="file">',
      );
      expect(formSectionOf(html)).not.toContain("multiple");
    });

    it("shows the principles under test as a checked, non-editable contract", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('id="contract-heading">Engineering contract</h2>');
      expect(html).toContain(">Architecture</h3>");
      expect(html).toContain(">Design</h3>");
      expect(html).toContain(">Testing</h3>");
      expect(html).toContain("<span>Hexagonal Architecture</span>");
      expect(html).toContain("<span>Dependency Direction</span>");
      expect(html).toContain("<span>SOLID</span>");
      // Scoped to the contract item: an example button shares this label.
      expect(html).toContain("<span>Single Responsibility</span>");
      expect(html).toContain("<span>DTT</span>");
      expect(html).toContain(
        '<label class="contract__item"><input type="checkbox" checked disabled><span>SOLID</span></label>',
      );
      expect(html).toContain("</label><label class=\"contract__item\">");
      expect(html).toContain("</div></div><div class=\"contract__group\">");
      expect(html.match(/type="checkbox" checked disabled/g)).toHaveLength(5);
      expect(html).toContain(
        '<p class="contract__count">5 principles enabled</p>',
      );
    });

    it("ends the playground with a status bar and a prominent analyze action", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain(
        '<p class="analyze-toolbar__meta">TypeScript · 0 lines</p>',
      );
      expect(html).toContain(
        '<button class="button button--primary" type="submit">Analyze →</button>',
      );
    });

    it("offers one link per example and marks none current", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain("<h2 id=\"examples-heading\">Try an example</h2>");
      expect(html).toContain(
        '<a class="button" href="/analyze?example=single-responsibility">Single Responsibility</a>',
      );
      expect(html).toContain(
        '<a class="button" href="/analyze?example=hexagonal-violation">Hexagonal violation</a>',
      );
      expect(html).toContain(
        '<a class="button" href="/analyze?example=dependency-inversion">Dependency inversion</a>',
      );
      expect(html).toContain(
        '<a class="button" href="/analyze?example=clean-architecture">Clean architecture</a>',
      );
      expect(html).toContain('</a><a class="button"');
      expect(html).not.toContain('aria-current="true"');
    });

    it("keeps the privacy promise to one subtle line", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain(
        '<p class="playground__note">Single-file analysis · Nothing you submit is stored.</p>',
      );
    });

    it("posts to /analyze as multipart form data", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain(
        '<form method="post" action="/analyze" enctype="multipart/form-data"',
      );
    });

    it("shows no error banner", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).not.toContain('role="alert"');
    });
  });

  describe("a prefilled example", () => {
    const exampleView: AnalyzeView = {
      kind: "form",
      sourceCode: "class UserService {}",
      language: "typescript",
      exampleId: "single-responsibility",
    };

    it("shows the example filename and marks its link current", () => {
      const html = renderAnalyzePage(exampleView);

      expect(html).toContain(
        '<span class="editor__filename">UserService.ts</span>',
      );
      expect(html).toContain(">class UserService {}</textarea>");
      expect(html).toContain(
        '<a class="button" href="/analyze?example=single-responsibility" aria-current="true">Single Responsibility</a>',
      );
      expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    });

    it("falls back to the blank form for an unknown example id", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "",
        language: "typescript",
        exampleId: "bogus",
      });

      expect(html).toContain('<span class="editor__filename">snippet.ts</span>');
      expect(html).not.toContain('aria-current="true"');
    });
  });

  describe("editor details", () => {
    it("grows the gutter with long content", () => {
      const source = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join(
        "\n",
      );
      const gutter = gutterSectionOf(
        renderAnalyzePage({
          kind: "form",
          sourceCode: source,
          language: "typescript",
          exampleId: null,
        }),
      );

      expect(gutter).toContain("<span>30</span>");
      expect(gutter).not.toContain("<span>31</span>");
    });

    it.each([
      ["python", "Python", "snippet.py"],
      ["javascript", "JavaScript", "snippet.js"],
      ["go", "Go", "snippet.go"],
      ["rust", "Rust", "snippet.rs"],
      ["java", "Java", "snippet.java"],
      ["  TYPESCRIPT ", "TypeScript", "snippet.ts"],
    ])(
      "names %p as %p with a %p filename",
      (language, label, filename) => {
        const html = renderAnalyzePage({
          kind: "form",
          sourceCode: "",
          language,
          exampleId: null,
        });

        expect(html).toContain(
          `<p class="analyze-toolbar__meta">${label} · 0 lines</p>`,
        );
        expect(html).toContain(
          `<span class="editor__filename">${filename}</span>`,
        );
      },
    );

    it("echoes an unlisted language untouched with a plain text filename", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "",
        language: "haskell",
        exampleId: null,
      });

      expect(html).toContain(
        '<p class="analyze-toolbar__meta">haskell · 0 lines</p>',
      );
      expect(html).toContain('<span class="editor__filename">snippet.txt</span>');
    });

    it.each([
      ["", "0 lines"],
      ["class Foo {}", "1 line"],
      ["class Foo {\n}", "2 lines"],
    ])("counts %p as %p", (sourceCode, label) => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode,
        language: "typescript",
        exampleId: null,
      });

      expect(html).toContain(
        `<p class="analyze-toolbar__meta">TypeScript · ${label}</p>`,
      );
    });

    it("escapes a hostile language in both the input value and the status bar", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "",
        language: 'a"b<c>',
        exampleId: null,
      });

      expect(html).toContain('value="a&quot;b&lt;c&gt;"');
      expect(html).toContain("a&quot;b&lt;c&gt; · 0 lines");
      expect(html).not.toContain('a"b<c>');
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
        '<div class="field__error" id="analyze-error" role="alert">sourceCode must not be empty.</div>',
      );
    });

    it("keeps the playground header and marks the editor invalid", () => {
      const html = renderAnalyzePage(view);

      expect(html).toContain("<h1>Analyze</h1>");
      expect(formSectionOf(html)).toContain(
        'aria-invalid="true" aria-describedby="analyze-error"',
      );
      expect(html).toContain(
        '<div class="field__error" id="analyze-error" role="alert">',
      );
    });

    it("echoes back what the visitor submitted, with a matching filename", () => {
      const html = renderAnalyzePage({
        kind: "invalid",
        message: "language must not be empty.",
        sourceCode: "class Foo {}",
        language: "python",
      });

      expect(html).toContain(">class Foo {}</textarea>");
      expect(html).toContain('<span class="editor__filename">snippet.py</span>');
      expect(html).toContain("Python · 1 line");
    });

    it("marks no example current on a rejected submission", () => {
      const html = renderAnalyzePage(view);

      expect(html).not.toContain('aria-current="true"');
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
