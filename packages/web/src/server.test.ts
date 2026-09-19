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
  createRequestHandler,
  FORBIDDEN_BODY,
  ORIGIN_VERIFY_HEADER,
  type RequestHandlerDependencies,
} from "./server.ts";

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
  readonly originSecret?: string;
}): (request: Request) => Promise<Response> {
  const deps: RequestHandlerDependencies = {
    listPrinciples: new ListPrinciples(
      new InMemoryPrincipleCatalog(overrides?.principles ?? []),
    ),
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog(overrides?.rules ?? []),
    ),
    eventStore: overrides?.eventStore ?? new InMemoryEventStore(),
    originSecret: overrides?.originSecret,
  };

  return createRequestHandler(deps);
}

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

  describe("origin secret enforcement", () => {
    const secret = "s3cr3t-from-cloudfront";

    it("refuses a request with no origin-verify header when a secret is set", async () => {
      const response = await handlerFor({ principles: [tdd], originSecret: secret })(
        new Request("http://localhost/"),
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.text()).resolves.toBe("Forbidden");
      expect(FORBIDDEN_BODY).toBe("Forbidden");
    });

    it("refuses a request whose origin-verify header does not match the secret", async () => {
      const response = await handlerFor({ principles: [tdd], originSecret: secret })(
        new Request("http://localhost/", {
          headers: { [ORIGIN_VERIFY_HEADER]: "wrong" },
        }),
      );

      expect(response.status).toBe(403);
      await expect(response.text()).resolves.toBe("Forbidden");
    });

    it("serves the request when the origin-verify header matches the secret", async () => {
      const response = await handlerFor({ principles: [tdd], originSecret: secret })(
        new Request("http://localhost/", {
          headers: { [ORIGIN_VERIFY_HEADER]: secret },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        "Test Driven Development",
      );
    });

    it("does not require the header when no secret is configured", async () => {
      const response = await handlerFor({ principles: [tdd] })(
        new Request("http://localhost/"),
      );

      expect(response.status).toBe(200);
    });

    it("does not require the header when the secret is the empty string", async () => {
      const response = await handlerFor({ principles: [tdd], originSecret: "" })(
        new Request("http://localhost/"),
      );

      expect(response.status).toBe(200);
    });

    it("enforces the secret on POST /analyze too, before the body is read", async () => {
      const form = new FormData();
      form.set("sourceCode", "class Foo {}");
      form.set("language", "typescript");
      const response = await handlerFor({ originSecret: secret })(
        new Request("http://localhost/analyze", { method: "POST", body: form }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("GET /analyze", () => {
    it("serves the blank single-file analysis form", async () => {
      const response = await handlerFor()(
        new Request("http://localhost/analyze"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/html; charset=utf-8",
      );
      await expect(response.text()).resolves.toContain(
        "<h1>Analyze a source file</h1>",
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
        postAnalyze({ sourceCode: "class Foo {}", language: "typescript" }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        "Received: class Foo {}",
      );
    });

    it("never caches a submitted analysis", async () => {
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({ sourceCode: "class Foo {}", language: "typescript" }),
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
          language: "typescript",
        }),
      );

      const body = await response.text();
      expect(body).toContain("Received: from the file");
      expect(body).not.toContain("from the textarea");
    });

    it("falls back to the pasted text when no file is given", async () => {
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({ sourceCode: "pasted only", language: "typescript" }),
      );

      await expect(response.text()).resolves.toContain(
        "Received: pasted only",
      );
    });

    it("rejects an empty submission with a 400 and echoes the language back", async () => {
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "", language: "typescript" }),
      );

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain("sourceCode must not be empty.");
      expect(body).toContain('value="typescript"');
    });

    it("never caches a rejected submission either", async () => {
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "", language: "typescript" }),
      );

      expect(response.headers.get("cache-control")).toBe(
        ANALYSIS_CACHE_CONTROL,
      );
    });

    it("rejects a submission with no language", async () => {
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "class Foo {}", language: "" }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "language must not be empty.",
      );
    });

    it("treats a wholly missing language field the same as an empty one", async () => {
      const form = new FormData();
      form.set("sourceCode", "class Foo {}");
      // "language" is deliberately never set.
      const response = await handlerFor()(
        new Request("http://localhost/analyze", { method: "POST", body: form }),
      );

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toContain(
        "language must not be empty.",
      );
    });

    it("does not treat an empty uploaded file as the submission, and falls back to pasted text", async () => {
      const emptyFile = new File([], "empty.ts", { type: "text/plain" });
      const response = await handlerFor({ rules: [echoRule] })(
        postAnalyze({
          sourceCode: "from the textarea",
          sourceFile: emptyFile,
          language: "typescript",
        }),
      );

      await expect(response.text()).resolves.toContain(
        "Received: from the textarea",
      );
    });

    it("shows an empty-findings state when the catalog has no rules", async () => {
      const response = await handlerFor()(
        postAnalyze({ sourceCode: "class Foo {}", language: "typescript" }),
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(
        "no rules were available to evaluate this submission",
      );
    });

    it("appends the run's events to the injected event store, without the source", async () => {
      const eventStore = new InMemoryEventStore();

      await handlerFor({ rules: [echoRule], eventStore })(
        postAnalyze({ sourceCode: "class Foo {}", language: "typescript" }),
      );

      const history = await eventStore.readAll();
      expect(history).toHaveLength(2);
      expect(history.map((event) => event.eventType)).toEqual([
        "AnalysisRequested",
        "AnalysisCompleted",
      ]);
      expect(JSON.stringify(history)).not.toContain("class Foo {}");
    });

    it("does not append anything for a rejected submission", async () => {
      const eventStore = new InMemoryEventStore();

      await handlerFor({ eventStore })(
        postAnalyze({ sourceCode: "", language: "typescript" }),
      );

      await expect(eventStore.readAll()).resolves.toEqual([]);
    });
  });
});
