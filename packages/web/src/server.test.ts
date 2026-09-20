import { describe, expect, it } from "bun:test";
import {
  AnalysisResult,
  AnalyzeSubject,
  Confidence,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  ListPrinciples,
  unwrap,
} from "@principled/core";
import type { EventStore, Principle, Rule } from "@principled/core";
import {
  ANALYSIS_CACHE_CONTROL,
  CLIENT_ASSET_CACHE_CONTROL,
  CLIENT_ASSET_CONTENT_TYPE,
  createRequestHandler,
  type RequestHandlerDependencies,
} from "./server.ts";
import type { ClientAssets } from "./client-assets.ts";

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
  readonly eventStore?: EventStore;
  readonly clientAssets?: ClientAssets | undefined;
}): (request: Request) => Promise<Response> {
  const deps: RequestHandlerDependencies = {
    listPrinciples: new ListPrinciples(
      new InMemoryPrincipleCatalog(overrides?.principles ?? []),
    ),
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog(overrides?.rules ?? []),
    ),
    eventStore: overrides?.eventStore ?? new InMemoryEventStore(),
    ...(overrides?.clientAssets !== undefined
      ? { clientAssets: overrides.clientAssets }
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
        '<span class="editor__language" id="editorLanguage" aria-label="Language is detected automatically">Auto-detect</span>',
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

      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(ANALYSIS_CACHE_CONTROL).toBe("no-store");
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
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "class Foo {}" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      );
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
      const response = await handlerFor({ rules: [echoRule], eventStore })(
        postAnalyze({ sourceCode: "def greet(name):\n    print(name)" }),
      );

      expect(response.status).toBe(200);
      const history = await eventStore.readAll();
      expect(history[0]?.eventType).toBe("AnalysisRequested");
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("python");
    });

    it("detects the language from the uploaded filename", async () => {
      const eventStore = new InMemoryEventStore();
      const file = new File(["hello world"], "main.py", {
        type: "text/plain",
      });
      const form = new FormData();
      form.set("sourceFile", file);
      const response = await handlerFor({ rules: [echoRule], eventStore })(
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
      await handlerFor({ rules: [echoRule], eventStore })(
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
      const response = await handlerFor({ rules: [echoRule], eventStore })(
        postAnalyze({ sourceCode: "package main" }),
      );

      expect(response.status).toBe(200);
      const history = await eventStore.readAll();
      expect(
        (history[0]?.payload as { language?: string }).language,
      ).toBe("go");
    });

    it("reports an undetectable snippet without a language field", async () => {
      const response = await handlerFor()(
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
});
