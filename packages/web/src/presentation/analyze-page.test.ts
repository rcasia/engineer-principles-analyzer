import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  AnalysisResult,
  Confidence,
  Evidence,
  SourceLocation,
  unwrap,
} from "@principled/core";
import type { AnalysisStatus } from "@principled/core";
import { hydrateGutter } from "../client/gutter.ts";
import {
  ANALYZE_PAGE_TITLE,
  AUTO_DETECT_LABEL,
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
  language?: string;
  analyzer?: { name: string; version: string };
}): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId: overrides.ruleId ?? "solid.srp",
      status: overrides.status ?? "compliant",
      confidence: unwrap(Confidence.of(overrides.confidence ?? 1)),
      method: overrides.method ?? "deterministic",
      evidence: overrides.evidence ?? [],
      explanation: overrides.explanation ?? "Looks fine.",
      language: overrides.language ?? "typescript",
      analyzer: overrides.analyzer ?? analyzer,
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
    language: "",
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
    it("says findings arrive live with no submit step, and what comes back", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain("<h1>Analyze</h1>");
      expect(html).toContain(
        '<p class="lede">Paste or upload one source file — findings appear beside the editor as you type, with no submit step. Each rule that applies returns a finding: a verdict, the lines of code it judged, a confidence level, and a suggested fix where the rule knows one.</p>',
      );
      expect(html).not.toContain("Paste or submit exactly one file");
    });

    it("renders an empty editor with auto-detect and no language input", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('<span class="editor__filename" id="editorFilename">snippet.txt</span>');
      expect(html).toContain(
        '<textarea class="editor__input" id="sourceCode" name="sourceCode" rows="16" spellcheck="false" placeholder="Paste exactly one source file"></textarea>',
      );
      expect(html).toContain(
        '<span class="editor__language" id="editorLanguage" data-language="" aria-label="Language is detected automatically">Auto-detect</span>',
      );
      expect(html).not.toContain('name="language"');
      expect(AUTO_DETECT_LABEL).toBe("Auto-detect");
    });

    it("renders an empty gutter for the empty editor, never filler numbers", () => {
      const gutter = gutterSectionOf(renderAnalyzePage(blankForm()));

      expect(gutter).toBe('<div class="editor__gutter" aria-hidden="true">');
    });

    it("numbers a single line exactly once", () => {
      const gutter = gutterSectionOf(
        renderAnalyzePage({
          kind: "form",
          sourceCode: "class UserService {}",
          language: "typescript",
          exampleId: null,
        }),
      );

      expect(gutter).toBe(
        '<div class="editor__gutter" aria-hidden="true"><span>1</span>',
      );
    });

    it("joins multi-line numbers with no separator", () => {
      const gutter = gutterSectionOf(
        renderAnalyzePage({
          kind: "form",
          sourceCode: "a\nb",
          language: "typescript",
          exampleId: null,
        }),
      );

      expect(gutter).toBe(
        '<div class="editor__gutter" aria-hidden="true"><span>1</span><span>2</span>',
      );
    });

    it("counts a trailing newline as an open line", () => {
      const gutter = gutterSectionOf(
        renderAnalyzePage({
          kind: "form",
          sourceCode: "a\n",
          language: "typescript",
          exampleId: null,
        }),
      );

      expect(gutter).toContain("<span>2</span>");
      expect(gutter).not.toContain("<span>3</span>");
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

    it("carries no contract panel — the rail holds findings only", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).not.toContain("contract-heading");
      expect(html).not.toContain("Engineering contract");
      expect(html).not.toContain("contract__item");
      expect(html).not.toContain('type="checkbox"');
    });

    it("ends the playground with a status bar, a live status and no submit button", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain(
        '<p class="analyze-toolbar__meta" id="editorMeta">Auto-detect · 0 lines</p>',
      );
      expect(html).toContain(
        '<p class="analyze-status" id="analyzeStatus" role="status">Waiting for code.</p>',
      );
      // The only submit button lives inside <noscript>: scripting visitors
      // analyse live, while scripting-disabled ones still post the form.
      expect(html).toContain(
        '<noscript><button class="button button--primary" type="submit">Analyze →</button></noscript>',
      );
      const withoutNoscript = html.replace(/<noscript>.*?<\/noscript>/s, "");
      expect(withoutNoscript).not.toContain("<button");
    });

    it("renders the live findings region beside the editor, inside the form", () => {
      const html = renderAnalyzePage(blankForm());

      expect(html).toContain('<div class="analyze-rail">');
      expect(html).toContain(
        '<section class="results-live" aria-labelledby="results-heading">',
      );
      expect(html).toContain('<h2 id="results-heading">Findings</h2>');
      expect(html).toContain('<div id="liveResults" aria-live="polite">');
      expect(html).toContain("<strong>No findings yet</strong>");
      expect(html).toContain(
        "<p>Findings appear here as you type — paste code, upload a file, or try an example.</p>",
      );
      // The rail reads editor, findings — so the verdict sits beside
      // the code with no scrolling, in tab order too.
      const editorAt = html.indexOf('aria-label="Source code editor"');
      const findingsAt = html.indexOf('id="liveResults"');
      const formEnd = html.indexOf("</form>");
      expect(editorAt).toBeGreaterThan(-1);
      expect(findingsAt).toBeGreaterThan(editorAt);
      expect(formEnd).toBeGreaterThan(findingsAt);
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
        '<form id="analyzeForm" method="post" action="/analyze" enctype="multipart/form-data" class="analyze-form">',
      );
    });

    it("renders the highlight backdrop with the escaped buffer behind the textarea", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "<b>hi</b>",
        language: "",
        exampleId: null,
      });

      expect(html).toContain(
        '<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight">&lt;b&gt;hi&lt;/b&gt;</code></pre>',
      );
      expect(html).toContain(
        ">&lt;b&gt;hi&lt;/b&gt;</textarea>",
      );
    });

    it("carries no example dataset on the blank form", () => {
      const html = renderAnalyzePage(blankForm());

      expect(formSectionOf(html)).not.toContain("data-example-filename");
    });

    it("renders the live-highlight script only when a bundle is available", () => {
      expect(renderAnalyzePage(blankForm())).not.toContain("<script");
      expect(renderAnalyzePage(blankForm())).toContain("</style>\n</head>");
      expect(
        renderAnalyzePage(blankForm(), {
          scriptSrc: "/assets/analyze-editor-a1b2c3.js",
        }),
      ).toContain(
        '<script type="module" src="/assets/analyze-editor-a1b2c3.js"></script>',
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
        '<span class="editor__filename" id="editorFilename">UserService.ts</span>',
      );
      expect(html).toContain(
        'data-example-filename="UserService.ts"',
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
        language: "",
        exampleId: "bogus",
      });

      expect(html).toContain('<span class="editor__filename" id="editorFilename">snippet.txt</span>');
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

      expect(gutter).toStartWith(
        '<div class="editor__gutter" aria-hidden="true"><span>1</span>',
      );
      expect(gutter).toContain("<span>30</span>");
      expect(gutter).not.toContain("<span>31</span>");
    });

    it("numbers three-digit lines without dropping the first line", () => {
      const source = Array.from(
        { length: 150 },
        (_, index) => `line ${index + 1}`,
      ).join("\n");
      const gutter = gutterSectionOf(
        renderAnalyzePage({
          kind: "form",
          sourceCode: source,
          language: "typescript",
          exampleId: null,
        }),
      );

      expect(gutter).toContain("<span>1</span>");
      expect(gutter).toContain("<span>150</span>");
      expect(gutter).not.toContain("<span>151</span>");
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
          `<p class="analyze-toolbar__meta" id="editorMeta">${label} · 0 lines</p>`,
        );
        expect(html).toContain(
          `<span class="editor__filename" id="editorFilename">${filename}</span>`,
        );
      },
    );

    it("names an unknown language as auto-detect with a plain text filename", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "",
        language: "",
        exampleId: null,
      });

      expect(html).toContain(
        '<p class="analyze-toolbar__meta" id="editorMeta">Auto-detect · 0 lines</p>',
      );
      expect(html).toContain('<span class="editor__filename" id="editorFilename">snippet.txt</span>');
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
        `<p class="analyze-toolbar__meta" id="editorMeta">TypeScript · ${label}</p>`,
      );
    });

    it("escapes a hostile detected language in the status bar and offers no input", () => {
      const html = renderAnalyzePage({
        kind: "form",
        sourceCode: "",
        language: 'a"b<c>',
        exampleId: null,
      });

      expect(html).toContain("a&quot;b&lt;c&gt; · 0 lines");
      expect(html).not.toContain('a"b<c>');
      expect(html).not.toContain('name="language"');
    });
  });

  describe("an invalid submission", () => {
    const view: AnalyzeView = {
      kind: "invalid",
      message: "sourceCode must not be empty.",
      sourceCode: "",
      language: "",
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

    it("keeps the live region and the noscript submit on a rejected submission", () => {
      const html = renderAnalyzePage(view);

      expect(html).toContain('<div id="liveResults" aria-live="polite">');
      expect(html).toContain(
        '<p class="analyze-status" id="analyzeStatus" role="status">Waiting for code.</p>',
      );
      expect(html).toContain(
        '<noscript><button class="button button--primary" type="submit">Analyze →</button></noscript>',
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
      expect(html).toContain('<span class="editor__filename" id="editorFilename">snippet.py</span>');
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
        '<ol aria-label="Analysis findings" class="findings-list"><li> <article class="panel finding" aria-labelledby="finding-0-heading"> <div class="status-row"> <span class="badge badge--success">Compliant</span> <span class="badge">deterministic</span> <span class="badge">100% confidence</span> </div> <h3 id="finding-0-heading" class="card-title">solid.srp</h3> <p class="card-copy">Looks fine.</p> <p class="finding-meta">Analyzed as TypeScript · fake-analyzer v0.0.0</p> </article> </li></ol>',
      );
    });

    it("attributes each finding to its analysed language and analyzer version", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({
            language: "python",
            analyzer: { name: "principled-solid-srp", version: "1" },
          }),
        ],
      });

      expect(html).toContain(
        '<p class="finding-meta">Analyzed as Python · principled-solid-srp v1</p>',
      );
    });

    it("escapes the provenance fields", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({
            language: "go",
            analyzer: { name: "<analyzer>", version: "<version>" },
          }),
        ],
      });

      expect(html).toContain(
        "Analyzed as Go · &lt;analyzer&gt; v&lt;version&gt;",
      );
      expect(html).not.toContain("<analyzer>");
    });

    it("summarises mixed findings with per-status counts", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [
          resultFor({ status: "compliant" }),
          resultFor({
            status: "violation",
            evidence: [
              unwrap(
                Evidence.of({
                  location: unwrap(SourceLocation.of({ startLine: 1 })),
                  excerpt: "class Foo {}",
                }),
              ),
            ],
          }),
          resultFor({
            status: "uncertain",
            confidence: 0.5,
            method: "heuristic",
            humanReviewRecommended: true,
          }),
        ],
      });

      expect(html).toContain(
        '<p class="results-summary">3 findings: 1 compliant · 1 violation · 1 uncertain</p>',
      );
    });

    it("uses the singular when exactly one finding exists", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({})],
      });

      expect(html).toContain(
        '<p class="results-summary">1 finding: 1 compliant</p>',
      );
    });

    it("shows no summary for an empty run", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).not.toContain("results-summary");
    });

    it("discloses the probabilistic nature of findings above the list", () => {
      const html = renderAnalyzePage({
        kind: "completed",
        results: [resultFor({})],
      });

      expect(html).toContain(
        '<p class="results-note">Findings are heuristic or AI-assisted judgments, not compiler errors. Confirm before acting.</p>',
      );
      expect(html.indexOf("results-note")).toBeLessThan(
        html.indexOf('<ol aria-label="Analysis findings"'),
      );
    });

    it("shows no probabilistic note when there is nothing to misread", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).not.toContain("results-note");
    });

    it("renders an empty run with no summary or note markup at all", () => {
      const html = renderAnalyzePage({ kind: "completed", results: [] });

      expect(html).toContain("</header>\n\n\n<div class=\"empty-state\">");
    });
  });
});

describe("analyze hydration", () => {
  const scriptSrc = "/assets/analyze-editor-test.js";

  function hydratedForm(): string {
    return renderAnalyzePage(
      { kind: "form", sourceCode: "", language: "", exampleId: null },
      { scriptSrc },
    );
  }

  it("loads the hashed island bundle as a module script", () => {
    expect(hydratedForm()).toContain(
      '<script type="module" src="/assets/analyze-editor-test.js"></script>',
    );
  });

  it("keeps the accessibility baseline with the script present", () => {
    const html = hydratedForm();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      '<a class="skip-link" href="#main">Skip to content</a>',
    );
    expect(html).toContain('<main class="playground" id="main">');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain(":focus-visible");
    expect(html).toContain(
      '<label class="visually-hidden" for="sourceCode">Source code</label>',
    );
    expect(html).toContain('<a href="/analyze" aria-current="page">Analyze</a>');
  });

  it("keeps the invalid banner a live alert with the script present", () => {
    const html = renderAnalyzePage(
      {
        kind: "invalid",
        message: "sourceCode must not be empty.",
        sourceCode: "",
        language: "",
      },
      { scriptSrc },
    );

    expect(html).toContain(
      '<div class="field__error" id="analyze-error" role="alert">sourceCode must not be empty.</div>',
    );
    expect(html).toContain(
      '<script type="module" src="/assets/analyze-editor-test.js"></script>',
    );
    expect(html).toContain(
      'aria-invalid="true" aria-describedby="analyze-error"',
    );
  });

  it.each([
    ["empty", ""],
    ["single line", "const a = 1;"],
    ["multi-line", "a\nb\nc"],
    ["trailing newline", "a\n"],
    ["only a newline", "\n"],
  ])("hydrates the identical gutter the server rendered for %s", (
    _label,
    sourceCode,
  ) => {
    const html = renderAnalyzePage({
      kind: "form",
      sourceCode,
      language: "",
      exampleId: null,
    });
    const section = gutterSectionOf(html);
    const serverInner = section.slice(section.indexOf(">") + 1);
    const window = new Window();

    try {
      const gutter = window.document.createElement("div");
      hydrateGutter(gutter, sourceCode);

      expect(gutter.innerHTML).toBe(serverInner);
    } finally {
      void window.close();
    }
  });
});
