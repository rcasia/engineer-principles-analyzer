import { describe, expect, it } from "bun:test";
import {
  AnalysisResult,
  AnalyzeSubject,
  Confidence,
  findForbiddenKeys,
  InMemoryEventStore,
  InMemoryJevClient,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  JevLanguageDetector,
  ListPrinciples,
  unwrap,
  WebMetrics,
} from "@principled/core";
import type {
  EventStore,
  LanguageDetector,
  Principle,
  Rule,
  RuleCatalog,
  WebMetricEvent,
  WebMetricsSummary,
} from "@principled/core";
import {
  ANALYSIS_CACHE_CONTROL,
  CLIENT_ASSET_CACHE_CONTROL,
  CLIENT_ASSET_CONTENT_TYPE,
  createRequestHandler,
  METRICS_CONTENT_TYPE,
  metricLanguageOf,
  type RequestHandlerDependencies,
} from "./server.ts";
import type { ClientAssets } from "./client-assets.ts";
import { InvalidJevResponseError } from "@principled/core";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };

/** Echoes the subject it was given, so a test can prove which source a request actually resolved to. */
const echoRule: Rule = {
  id: "fake.echo",
  evaluate: async (subject) =>
    unwrap(
      AnalysisResult.of({
        ruleId: "fake.echo",
        status: "compliant",
        confidence: unwrap(Confidence.of(1)),
        method: "deterministic",
        evidence: [],
        explanation: `Received: ${subject.sourceCode}`,
        language: subject.language,
        analyzer: { name: "fake", version: "0" },
        humanReviewRecommended: false,
      }),
    ),
};

function handlerFor(overrides?: {
  readonly principles?: readonly Principle[];
  readonly rules?: readonly Rule[];
  readonly ruleCatalog?: RuleCatalog;
  readonly eventStore?: EventStore;
  readonly clientAssets?: ClientAssets | undefined;
  /**
   * Scripted Jev language verdicts, one per detection. Defaults to a single
   * `typescript`: most posts carry TypeScript evidence and only assert the
   * echo. An empty array exhausts the script, so detection fails like a Jev
   * outage; `["other"]` scripts the no-match verdict. A full detector
   * replaces the script entirely, for failures the script cannot produce.
   */
  readonly jevChoices?: readonly string[];
  readonly languageDetector?: LanguageDetector;
  readonly recordMetric?: ((event: WebMetricEvent) => void) | undefined;
  readonly readMetrics?: (() => WebMetricsSummary) | undefined;
}): (request: Request) => Promise<Response> {
  const deps: RequestHandlerDependencies = {
    listPrinciples: new ListPrinciples(
      new InMemoryPrincipleCatalog(overrides?.principles ?? []),
    ),
    analyzeSubject: new AnalyzeSubject(
      overrides?.ruleCatalog ?? new InMemoryRuleCatalog(overrides?.rules ?? []),
    ),
    languageDetector:
      overrides?.languageDetector ??
      new JevLanguageDetector(
        new InMemoryJevClient(
          [],
          (overrides?.jevChoices ?? ["typescript"]).map((choice) => ({
            choice,
            probabilities: { [choice]: 1 },
            confidence: 1,
            model: "in-memory",
          })),
        ),
      ),
    eventStore: overrides?.eventStore ?? new InMemoryEventStore(),
    ...(overrides?.clientAssets !== undefined
      ? { clientAssets: overrides.clientAssets }
      : {}),
    ...(overrides?.recordMetric !== undefined
      ? { recordMetric: overrides.recordMetric }
      : {}),
    ...(overrides?.readMetrics !== undefined
      ? { readMetrics: overrides.readMetrics }
      : {}),
  };

  return createRequestHandler(deps);
}

const editorAssets: ClientAssets = {
  scriptSrc: "/assets/analyze-editor-a1b2c3.js",
  files: { "analyze-editor-a1b2c3.js": "console.log(1);" },
};

describe("createRequestHandler", () => {
  it("serves the principles page as html at the root", async () => {
    const response = await handlerFor({ principles: [tdd] })(
      new Request("http://localhost/"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    await expect(response.text()).resolves.toContain(
      "Test Driven Development",
    );
  });

  it("lets the cdn cache the page and serve it stale while revalidating", async () => {
    const response = await handlerFor()(new Request("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=600",
    );
  });

  it("lets the cdn cache 404s so they never reach the origin twice", async () => {
    const response = await handlerFor()(new Request("http://localhost/gone"));

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("declares hashed client assets immutable for a year", () => {
    expect(CLIENT_ASSET_CACHE_CONTROL).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(CLIENT_ASSET_CONTENT_TYPE).toBe("text/javascript; charset=utf-8");
  });

  describe("GET /assets/*", () => {
    it("serves a built editor bundle as immutable javascript", async () => {
      const response = await handlerFor({ clientAssets: editorAssets })(
        new Request("http://localhost/assets/analyze-editor-a1b2c3.js"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/javascript; charset=utf-8",
      );
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=31536000, immutable",
      );
      await expect(response.text()).resolves.toBe("console.log(1);");
    });

    it("404s an asset that was never built", async () => {
      const response = await handlerFor({ clientAssets: editorAssets })(
        new Request("http://localhost/assets/analyze-editor-zzzz.js"),
      );

      expect(response.status).toBe(404);
      await expect(response.text()).resolves.toBe("Not found");
    });

    it("404s assets when no bundle was wired at all", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/assets/analyze-editor-a1b2c3.js"),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("live-highlight script", () => {
    it("omits the script tag without a built bundle", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze"),
      );

      await expect(response.text()).resolves.not.toContain("<script");
    });

    it("loads the hashed bundle on the blank playground", async () => {
      const response = await handlerFor({ clientAssets: editorAssets })(
        new Request("http://localhost/analyze"),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        '<script type="module" src="/assets/analyze-editor-a1b2c3.js"></script>',
      );
    });

    it("loads the hashed bundle on a prefilled example", async () => {
      const response = await handlerFor({ clientAssets: editorAssets })(
        new Request("http://localhost/analyze?example=single-responsibility"),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        '<script type="module" src="/assets/analyze-editor-a1b2c3.js"></script>',
      );
    });

    it("keeps the script on a rejected submission so the editor stays live", async () => {
      const form = new FormData();
      form.set("sourceCode", "");
      const response = await handlerFor({ clientAssets: editorAssets })(
        new Request("http://localhost/analyze", {
          method: "POST",
          body: form,
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        '<script type="module" src="/assets/analyze-editor-a1b2c3.js"></script>',
      );
    });
  });

  it("ignores the query string when routing", async () => {
    const response = await handlerFor()(
      new Request("http://localhost/?anything=1"),
    );

    expect(response.status).toBe(200);
  });

  it("serves the internal design playground", async () => {
    const response = await handlerFor()(new Request("http://localhost/design"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    await expect(response.text()).resolves.toContain(
      "Design playground | Principled",
    );
  });

  it.each(["/missing", "/principles", "/design/", "//"])(
    "responds 404 as plain text for %p",
    async (pathname) => {
      const response = await handlerFor()(
        new Request(`http://localhost${pathname}`),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      await expect(response.text()).resolves.toBe("Not found");
    },
  );

  describe("GET /analyze", () => {
    it("serves the blank analysis playground", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/html; charset=utf-8",
      );
      const body = await response.text();
      expect(body).toContain("<h1>Analyze</h1>");
      expect(body).toContain(
        'placeholder="Paste exactly one source file"></textarea>',
      );
    });

    it("lets the cdn cache the blank form like any other static page", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze"),
      );

      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=60, stale-while-revalidate=600",
      );
    });

    it("prefills the editor when an example link is followed", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze?example=single-responsibility"),
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(
        '<span class="editor__filename" id="editorFilename">UserService.ts</span>',
      );
      expect(body).toContain("sendWelcomeEmail");
      expect(body).toContain(
        '<a class="button" href="/analyze?example=single-responsibility" aria-current="true">',
      );
      expect(body).toContain("TypeScript · 7 lines");
      expect(body).toContain('id="editorLanguage" data-language="typescript"');
    });

    it("never caches a prefilled example, as the cdn cache key ignores the query", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze?example=single-responsibility"),
      );

      expect(response.headers.get("cache-control")).toBe(
        ANALYSIS_CACHE_CONTROL,
      );
    });

    it("renders the blank form with auto-detect and no language input", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze"),
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain(
        '<span class="editor__language" id="editorLanguage" data-language="" aria-label="Language is detected automatically">Auto-detect</span>',
      );
      expect(body).toContain('<span class="editor__filename" id="editorFilename">snippet.txt</span>');
      expect(body).toContain("Auto-detect · 0 lines");
      expect(body).not.toContain('name="language"');
    });

    it("falls back to the blank form for an unknown example", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze?example=bogus"),
      );

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('<span class="editor__filename" id="editorFilename">snippet.txt</span>');
      expect(body).not.toContain('aria-current="true"');
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=60, stale-while-revalidate=600",
      );
    });
  });

  describe("POST /analyze", () => {
    function postAnalyze(fields: Record<string, string | File>): Request {
      const form = new FormData();

      for (const [key, value] of Object.entries(fields)) {
        form.set(key, value);
      }

      return new Request("http://localhost/analyze", {
        method: "POST",
        body: form,
      });
    }

    it("runs the pasted source through every registered rule and renders the findings", async () => {
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({ sourceCode: "interface Foo { readonly name: string }" }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        "Received: interface Foo { readonly name: string }",
      );
    });

    it("never caches a submitted analysis", async () => {
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({ sourceCode: "interface Foo { readonly name: string }" }),
      );

      expect(response.headers.get("cache-control")).toBe("no-store, private");
      expect(ANALYSIS_CACHE_CONTROL).toBe("no-store, private");
    });

    it("prefers an uploaded file over pasted text", async () => {
      const file = new File(["from the file"], "example.ts", {
        type: "text/plain",
      });
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({
          sourceCode: "from the textarea",
          sourceFile: file,
        }),
      );

      const body = await response.text();
      expect(body).toContain("Received: from the file");
      expect(body).not.toContain("from the textarea");
    });

    it("falls back to the pasted text when no file is given", async () => {
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({ sourceCode: "def greet(name):\n    print(name)" }),
      );

      await expect(response.text()).resolves.toContain(
        "Received: def greet(name):",
      );
    });

    it("rejects an empty submission with a 400 and shows auto-detect", async () => {
      const response = await handlerFor()(postAnalyze({ sourceCode: "" }));

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain("sourceCode must not be empty.");
      expect(body).toContain("Auto-detect · 0 lines");
      expect(body).not.toContain('name="language"');
    });

    it("never caches a rejected submission either", async () => {
      const response = await handlerFor()(postAnalyze({ sourceCode: "" }));

      expect(response.headers.get("cache-control")).toBe(
        ANALYSIS_CACHE_CONTROL,
      );
    });

    it("rejects a submission it cannot detect", async () => {
      const response = await handlerFor({ jevChoices: ["other"] })(
        postAnalyze({ sourceCode: "class Foo {}" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      );
    });

    it("renders the detection guidance when Jev itself fails", async () => {
      const response = await handlerFor({ jevChoices: [] })(
        postAnalyze({ sourceCode: "package main" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      );
    });

    it("renders the detection guidance for an invalid Jev wire shape", async () => {
      const languageDetector: LanguageDetector = {
        detectLanguage: () =>
          Promise.reject(
            new InvalidJevResponseError(
              'Jev answer choice for question "choice" must be one of: go.',
            ),
          ),
      };
      const response = await handlerFor({ languageDetector })(
        postAnalyze({ sourceCode: "package main" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      );
    });

    it("lets an unexpected detector failure escape instead of masking it", async () => {
      const languageDetector: LanguageDetector = {
        detectLanguage: () => Promise.reject(new Error("boom")),
      };

      await expect(
        handlerFor({ languageDetector })(
          postAnalyze({ sourceCode: "package main" }),
        ),
      ).rejects.toThrow("boom");
    });

    it("reports the empty source rather than a detection failure for whitespace", async () => {
      const response = await handlerFor()(postAnalyze({ sourceCode: "   " }));

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "sourceCode must not be empty.",
      );
    });

    it("treats a non-text sourceCode field as empty", async () => {
      const form = new FormData();
      form.set(
        "sourceCode",
        new File(["def greet(name):\n    print(name)"], "pasted.txt"),
      );
      const response = await handlerFor()(
        new Request("http://localhost/analyze", {
          method: "POST",
          body: form,
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "sourceCode must not be empty.",
      );
    });

    it("detects the language from pasted content", async () => {
      const eventStore = new InMemoryEventStore();
      const response = await handlerFor({
        rules: [echoRule],
        eventStore,
        jevChoices: ["python"],
      })(postAnalyze({ sourceCode: "def greet(name):\n    print(name)" }));

      expect(response.status).toBe(200);
      const history = await eventStore.readAll();
      expect(history[0]?.eventType).toBe("AnalysisRequested");
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("python");
    });

    it("detects the language from the uploaded file via Jev", async () => {
      const eventStore = new InMemoryEventStore();
      const file = new File(["hello world"], "main.py", {
        type: "text/plain",
      });
      const form = new FormData();
      form.set("sourceFile", file);
      const response = await handlerFor({
        rules: [echoRule],
        eventStore,
        jevChoices: ["python"],
      })(
        new Request("http://localhost/analyze", {
          method: "POST",
          body: form,
        }),
      );

      expect(response.status).toBe(200);
      const history = await eventStore.readAll();
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("python");
    });

    it("ignores a language field when one is sent and detects instead", async () => {
      const eventStore = new InMemoryEventStore();
      const file = new File(["def greet(name):\n    print(name)"], "main.py", {
        type: "text/plain",
      });
      const form = new FormData();
      form.set("sourceFile", file);
      form.set("language", "go");
      await handlerFor({ rules: [echoRule], eventStore, jevChoices: ["python"] })(
        new Request("http://localhost/analyze", {
          method: "POST",
          body: form,
        }),
      );

      const history = await eventStore.readAll();
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("python");
    });

    it("detects go from content without a language field", async () => {
      const eventStore = new InMemoryEventStore();
      const response = await handlerFor({
        rules: [echoRule],
        eventStore,
        jevChoices: ["go"],
      })(postAnalyze({ sourceCode: "package main" }));

      expect(response.status).toBe(200);
      const history = await eventStore.readAll();
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("go");
    });

    it("reports an undetectable snippet without a language field", async () => {
      const response = await handlerFor({ jevChoices: ["other"] })(
        postAnalyze({ sourceCode: "hello world" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      );
    });

    it("reports the empty source rather than a detection failure when both apply", async () => {
      const file = new File(["   "], "main.py", { type: "text/plain" });
      const form = new FormData();
      form.set("sourceFile", file);
      const response = await handlerFor({ rules: [echoRule] })(
        new Request("http://localhost/analyze", {
          method: "POST",
          body: form,
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "sourceCode must not be empty.",
      );
    });

    it("does not treat an empty uploaded file as the submission, and falls back to pasted text", async () => {
      const emptyFile = new File([], "empty.ts", { type: "text/plain" });
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({
          sourceCode: "def greet(name):\n    print(name)",
          sourceFile: emptyFile,
        }),
      );

      await expect(response.text()).resolves.toContain(
        "Received: def greet(name):",
      );
    });

    it("shows an empty-findings state when the catalog has no rules", async () => {
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "interface Foo { readonly name: string }" }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        "no rules were available to evaluate this submission",
      );
    });

    it("appends the run's events to the injected event store, without the source", async () => {
      const eventStore = new InMemoryEventStore();

      await handlerFor({ rules: [echoRule], eventStore })(
        postAnalyze({ sourceCode: "interface Foo { readonly name: string }" }),
      );

      const history = await eventStore.readAll();
      expect(history).toHaveLength(2);
      expect(history.map((event) => event.eventType)).toEqual([
        "AnalysisRequested",
        "AnalysisCompleted",
      ]);
      expect(JSON.stringify(history)).not.toContain(
        "interface Foo { readonly name: string }",
      );
    });

    it("does not append anything for a rejected submission", async () => {
      const eventStore = new InMemoryEventStore();

      await handlerFor({ eventStore })(postAnalyze({ sourceCode: "" }));

      await expect(eventStore.readAll()).resolves.toEqual([]);
    });
  });

  describe("POST /detect", () => {
    function postDetect(payload: unknown): Request {
      return new Request("http://localhost/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    function postRawDetect(body: string): Request {
      return new Request("http://localhost/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    }

    function detectorWith(
      ...choices: readonly string[]
    ): {
      detector: LanguageDetector;
      client: InMemoryJevClient;
    } {
      const client = new InMemoryJevClient(
        [],
        choices.map((choice) => ({
          choice,
          probabilities: { [choice]: 1 },
          confidence: 1,
          model: "in-memory",
        })),
      );
      return { detector: new JevLanguageDetector(client), client };
    }

    it("answers the Jev verdict as JSON for the live island", async () => {
      const { detector, client } = detectorWith("python");
      const response = await handlerFor({ languageDetector: detector })(
        postDetect({ sourceCode: "def greet(name):", filename: "main.py" }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      await expect(response.json()).resolves.toEqual({ language: "python" });
      expect(client.choiceCalls).toHaveLength(1);
      expect(client.choiceCalls[0]?.state).toEqual({
        sourceCode: "def greet(name):",
        filename: "main.py",
      });
    });

    it("never caches a lookup", async () => {
      const response = await handlerFor({ jevChoices: ["python"] })(
        postDetect({ sourceCode: "def greet(name):" }),
      );

      expect(response.headers.get("cache-control")).toBe("no-store, private");
      expect(ANALYSIS_CACHE_CONTROL).toBe("no-store, private");
    });

    it("answers empty when Jev reports unknown", async () => {
      const response = await handlerFor({ jevChoices: ["other"] })(
        postDetect({ sourceCode: "hello world" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
    });

    it("answers empty when Jev itself fails", async () => {
      const response = await handlerFor({ jevChoices: [] })(
        postDetect({ sourceCode: "package main" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
    });

    it("answers empty for a blank buffer without asking Jev", async () => {
      const { detector, client } = detectorWith("go");
      const response = await handlerFor({ languageDetector: detector })(
        postDetect({ sourceCode: "   " }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
      expect(client.choiceCalls).toEqual([]);
    });

    it("treats a non-string source as a blank buffer", async () => {
      const { detector, client } = detectorWith("go");
      const response = await handlerFor({ languageDetector: detector })(
        postDetect({ sourceCode: 7 }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
      expect(client.choiceCalls).toEqual([]);
    });

    it("treats a non-string filename as no hint", async () => {
      const { detector, client } = detectorWith("go");
      const response = await handlerFor({ languageDetector: detector })(
        postDetect({ sourceCode: "package main", filename: 7 }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "go" });
      expect(client.choiceCalls).toHaveLength(1);
      expect(client.choiceCalls[0]?.state).toEqual({
        sourceCode: "package main",
        filename: "",
      });
    });

    it("treats a null body as a blank buffer", async () => {
      const { detector, client } = detectorWith("go");
      const response = await handlerFor({ languageDetector: detector })(
        postDetect(null),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
      expect(client.choiceCalls).toEqual([]);
    });

    it("treats a non-object body as a blank buffer", async () => {
      const response = await handlerFor({ jevChoices: ["go"] })(
        postDetect("just a string"),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ language: "" });
    });

    it("rejects a body that is not JSON", async () => {
      const response = await handlerFor({ jevChoices: ["go"] })(
        postRawDetect("this is not json"),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "expected a JSON body with sourceCode",
      });
      expect(response.headers.get("cache-control")).toBe("no-store, private");
    });

    it("404s a GET lookup", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/detect"),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("product metrics", () => {
    function postSource(fields: Record<string, string | File>): Request {
      const form = new FormData();

      for (const [key, value] of Object.entries(fields)) {
        form.set(key, value);
      }

      return new Request("http://localhost/analyze", {
        method: "POST",
        body: form,
      });
    }

    function metricsWiring(): {
      readonly events: WebMetricEvent[];
      readonly recordMetric: (event: WebMetricEvent) => void;
      readonly readMetrics: () => WebMetricsSummary;
    } {
      let metrics = WebMetrics.empty();
      const events: WebMetricEvent[] = [];

      return {
        events,
        recordMetric: (event) => {
          events.push(event);
          metrics = metrics.record(event);
        },
        readMetrics: () => metrics.summarize(),
      };
    }

    it("records a completed analysis as minimized facts, never the source", async () => {
      const wiring = metricsWiring();
      const source = "interface Foo { readonly name: string }";

      const response = await handlerFor({
        rules: [echoRule],
        recordMetric: wiring.recordMetric,
      })(postSource({ sourceCode: source }));

      expect(response.status).toBe(200);
      expect(wiring.events).toHaveLength(2);
      expect(wiring.events[0]).toEqual({ kind: "analysis-requested" });

      const settled = wiring.events[1];
      expect(settled?.kind).toBe("analysis-completed");

      if (settled?.kind === "analysis-completed") {
        expect(settled.language).toBe("typescript");
        expect(settled.ruleIds).toEqual(["fake.echo"]);
        expect(typeof settled.durationMs).toBe("number");
        expect(settled.durationMs).toBeGreaterThanOrEqual(0);
      }

      for (const event of wiring.events) {
        expect(findForbiddenKeys(event)).toEqual([]);
      }

      expect(JSON.stringify(wiring.events)).not.toContain(source);
    });

    it("records a rejected submission as requested then failed", async () => {
      const wiring = metricsWiring();

      const response = await handlerFor({
        recordMetric: wiring.recordMetric,
      })(postSource({ sourceCode: "" }));

      expect(response.status).toBe(400);
      expect(wiring.events).toHaveLength(2);
      expect(wiring.events[0]).toEqual({ kind: "analysis-requested" });
      expect(wiring.events[1]?.kind).toBe("analysis-failed");
      expect(wiring.events[1]).toEqual({
        kind: "analysis-failed",
        language: "undetected",
        ruleIds: [],
        durationMs: expect.any(Number),
      });
    });

    it("records a failed run and still surfaces the engine error", async () => {
      const wiring = metricsWiring();
      const catalog: RuleCatalog = {
        all: async () => {
          throw new Error("catalog down");
        },
      };

      await expect(
        handlerFor({ ruleCatalog: catalog, recordMetric: wiring.recordMetric })(
          postSource({ sourceCode: "package main" }),
        ),
      ).rejects.toThrow("catalog down");

      expect(wiring.events).toHaveLength(2);
      expect(wiring.events[0]).toEqual({ kind: "analysis-requested" });
      expect(wiring.events[1]?.kind).toBe("analysis-failed");
    });

    it("serves the aggregate summary as json without wiring anything", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/metrics"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(METRICS_CONTENT_TYPE);
      expect(METRICS_CONTENT_TYPE).toBe("application/json; charset=utf-8");
      await expect(response.json()).resolves.toEqual({
        totalRequests: 0,
        completedAnalyses: 0,
        failedAnalyses: 0,
        failureRate: 0,
        abandonedRequests: 0,
        latencyP50Ms: null,
        latencyP95Ms: null,
        languageDistribution: {},
        ruleSelectionDistribution: {},
      });
    });

    it("serves recorded aggregates per language and rule", async () => {
      const wiring = metricsWiring();
      const handler = handlerFor({
        rules: [echoRule],
        recordMetric: wiring.recordMetric,
        readMetrics: wiring.readMetrics,
      });

      await handler(
        postSource({ sourceCode: "interface Foo { readonly name: string }" }),
      );
      await handler(postSource({ sourceCode: "" }));

      const response = await handler(new Request("http://localhost/metrics"));
      const summary = (await response.json()) as WebMetricsSummary;

      expect(summary.totalRequests).toBe(2);
      expect(summary.completedAnalyses).toBe(1);
      expect(summary.failedAnalyses).toBe(1);
      expect(summary.failureRate).toBe(0.5);
      expect(summary.abandonedRequests).toBe(0);
      expect(summary.languageDistribution).toEqual({
        typescript: 1,
        undetected: 1,
      });
      expect(summary.ruleSelectionDistribution).toEqual({ "fake.echo": 1 });
    });

    it("does not answer metrics over other methods", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/metrics", { method: "POST" }),
      );

      expect(response.status).toBe(404);
    });

    it("buckets an undetectable language instead of an empty key", () => {
      expect(metricLanguageOf("")).toBe("undetected");
      expect(metricLanguageOf("typescript")).toBe("typescript");
    });
  });
});
