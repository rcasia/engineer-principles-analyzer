import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import type { PlainResult } from "../analysis-payload.ts";
import { enhanceAnalyzeEditor } from "./analyze-editor.ts";
import {
  enhanceLiveAnalysis,
  fetchAnalysis,
  LIVE_ANALYSIS_DEBOUNCE_MS,
  LIVE_FETCH_FAILED_MESSAGE,
  type AnalyzeBuffer,
  type LiveOutcome,
} from "./live-analysis.ts";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(
  respond: () => Response | Promise<Response>,
): {
  readonly fetchFn: typeof fetch;
  readonly calls: { readonly url: unknown; readonly init: unknown }[];
} {
  const calls: { readonly url: unknown; readonly init: unknown }[] = [];
  const fetchFn = (async (url: unknown, init: unknown) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("live constants", () => {
  it("pins the debounce and the transport-failure wording", () => {
    expect(LIVE_ANALYSIS_DEBOUNCE_MS).toBe(150);
    expect(LIVE_FETCH_FAILED_MESSAGE).toBe(
      "Could not reach the analysis service — your code is safe in the editor; try again in a moment.",
    );
  });
});

describe("fetchAnalysis", () => {
  const okPayload = {
    language: "python",
    results: [
      {
        ruleId: "solid.srp",
        status: "compliant",
        confidence: 1,
        method: "deterministic",
        evidence: [],
        explanation: "Looks fine.",
        language: "python",
        analyzer: { name: "fake", version: "0" },
        limitations: [],
        humanReviewRecommended: false,
      },
    ],
  };

  it("posts the buffer as JSON and returns the findings", async () => {
    const { fetchFn, calls } = stubFetch(() => jsonResponse(okPayload));

    const outcome = await fetchAnalysis(
      "def greet(name):",
      "main.py",
      fetchFn,
    );

    expect(outcome).toEqual({
      ok: true,
      language: "python",
      results: okPayload.results,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/analyze");
    expect(calls[0]?.init).toEqual({
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ sourceCode: "def greet(name):", filename: "main.py" }),
    });
  });

  it("sends an empty filename when none is given", async () => {
    const { fetchFn, calls } = stubFetch(() => jsonResponse(okPayload));

    await fetchAnalysis("def greet(name):", undefined, fetchFn);

    expect((calls[0]?.init as { body?: string }).body).toBe(
      JSON.stringify({ sourceCode: "def greet(name):", filename: "" }),
    );
  });

  it("sends an empty filename when null is given", async () => {
    const { fetchFn, calls } = stubFetch(() => jsonResponse(okPayload));

    await fetchAnalysis("def greet(name):", null as unknown as string, fetchFn);

    expect((calls[0]?.init as { body?: string }).body).toBe(
      JSON.stringify({ sourceCode: "def greet(name):", filename: "" }),
    );
  });

  it("maps a rejection to the server's error and language", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse(
        {
          error:
            "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
          language: "",
        },
        400,
      ),
    );

    await expect(
      fetchAnalysis("hello world", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error:
        "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
      language: "",
    });
  });

  it("falls back to the transport message for an empty rejection error", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ error: "", language: "go" }, 400),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "go",
    });
  });

  it("falls back to the transport message for a non-string rejection error", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ error: 7, language: "go" }, 400),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "go",
    });
  });

  it("falls back to auto-detect for a non-string rejection language", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ error: "Nope.", language: 7 }, 400),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({ ok: false, error: "Nope.", language: "" });
  });

  it("falls back for a rejection body that is not JSON", async () => {
    const { fetchFn } = stubFetch(
      () => new Response("not json", { status: 400 }),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "",
    });
  });

  it("falls back for a null rejection body", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse(null, 400));

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "",
    });
  });

  it("falls back for a non-string rejection error with a usable length", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ error: ["stale", "news"], language: "go" }, 400),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "go",
    });
  });

  it("falls back when the success body is not JSON", async () => {
    const { fetchFn } = stubFetch(
      () => new Response("not json", { status: 200 }),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "",
    });
  });

  it("falls back when the success body carries no results array", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ language: "go", results: "broken" }),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "go",
    });
  });

  it("falls back to auto-detect for a non-string success language", async () => {
    const { fetchFn } = stubFetch(() =>
      jsonResponse({ language: 7, results: [] }),
    );

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({ ok: true, language: "", results: [] });
  });

  it("falls back when the request itself fails", async () => {
    const fetchFn = (() =>
      Promise.reject(new Error("connection reset"))) as unknown as typeof fetch;

    await expect(
      fetchAnalysis("package main", undefined, fetchFn),
    ).resolves.toEqual({
      ok: false,
      error: LIVE_FETCH_FAILED_MESSAGE,
      language: "",
    });
  });
});

/** happy-dom events are not the DOM lib's `Event`; the cast keeps `dispatchEvent` happy. */
function inputEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("input", { bubbles: true }) as unknown as Event;
}

function changeEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("change", { bubbles: true }) as unknown as Event;
}

function clickEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("click", {
    bubbles: true,
    cancelable: true,
  }) as unknown as Event;
}

function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findingFor(ruleId: string): PlainResult {
  return {
    ruleId,
    status: "compliant",
    confidence: 1,
    method: "deterministic",
    evidence: [],
    explanation: "Looks fine.",
    language: "typescript",
    analyzer: { name: "fake", version: "0" },
    limitations: [],
    humanReviewRecommended: false,
  };
}

interface RecordedCall {
  readonly sourceCode: string;
  readonly filename: string | undefined;
}

function liveDom(
  sourceCode: string,
  options?: {
    readonly language?: string;
    readonly exampleFilename?: string;
    readonly withExamples?: boolean;
    readonly withoutOptionals?: boolean;
  },
): {
  window: InstanceType<typeof Window>;
  document: Document;
  textarea: HTMLTextAreaElement;
} {
  const window = new Window();
  const document = window.document as unknown as Document;
  const host = document.createElement("div");
  const language = options?.language ?? "";
  const exampleAttr =
    options?.exampleFilename === undefined
      ? ""
      : ` data-example-filename="${options.exampleFilename}"`;
  const optionals = options?.withoutOptionals === true ? "" : (
      `<span id="editorFilename">snippet.txt</span>` +
      `<span id="editorLanguage" data-language="${language}">Auto-detect</span>` +
      `<p id="editorMeta"></p>` +
      `<input id="sourceFile" name="sourceFile" type="file">`
    );
  host.innerHTML =
    `<form id="analyzeForm"${exampleAttr}>` +
    `<div class="editor__stage">` +
    `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
    `</div>` +
    `<textarea id="sourceCode" name="sourceCode"></textarea>` +
    optionals +
    `<div class="analyze-toolbar">` +
    `<p class="analyze-status" id="analyzeStatus" role="status">Waiting for code.</p>` +
    `</div>` +
    `</form>` +
    `<section class="results-live"><div id="liveResults" aria-live="polite"></div></section>` +
    (options?.withExamples === true
      ? `<section class="examples"><a class="button" href="/analyze?example=single-responsibility">Single Responsibility</a></section>`
      : "");
  document.body.appendChild(host);
  const textarea = host.querySelector(
    "#sourceCode",
  ) as unknown as HTMLTextAreaElement;
  textarea.value = sourceCode;

  return { window, document, textarea };
}

/** A lookup that must never run: no-op paths return before analysing. */
function neverAnalyze(): AnalyzeBuffer {
  return () => Promise.reject(new Error("analyze must not run"));
}

function statusOf(document: Document): string | null {
  return document.querySelector("#analyzeStatus")?.textContent ?? null;
}

function resultsOf(document: Document): string {
  return document.querySelector("#liveResults")?.innerHTML ?? "";
}

describe("enhanceLiveAnalysis", () => {
  it("debounces the production delay by default only in production wiring", () => {
    expect(LIVE_ANALYSIS_DEBOUNCE_MS).toBe(150);
  });

  it("is a no-op without an analyze form", () => {
    const window = new Window();

    try {
      expect(
        enhanceLiveAnalysis(
          window.document as unknown as Document,
          neverAnalyze(),
          5,
        ),
      ).toBe(false);
    } finally {
      void window.close();
    }
  });

  it.each([["sourceCode"], ["liveResults"], ["analyzeStatus"]])(
    "is a no-op when #%p is missing",
    (id) => {
      const { window, document } = liveDom("package main");

      try {
        document.querySelector(`#${id}`)?.remove();

        expect(enhanceLiveAnalysis(document, neverAnalyze(), 5)).toBe(false);
      } finally {
        void window.close();
      }
    },
  );

  it("renders the empty state for an empty buffer without analysing", async () => {
    const { window, document } = liveDom("");

    try {
      expect(enhanceLiveAnalysis(document, neverAnalyze(), 5)).toBe(true);

      expect(resultsOf(document)).toContain("No findings yet");
      expect(resultsOf(document)).toContain(
        "Findings appear here as you type",
      );
      expect(statusOf(document)).toBe("Waiting for code.");
    } finally {
      void window.close();
    }
  });

  it("renders the empty state for a whitespace-only buffer without analysing", async () => {
    const { window, document } = liveDom("   ");

    try {
      expect(enhanceLiveAnalysis(document, neverAnalyze(), 5)).toBe(true);
      await tick(20);

      expect(resultsOf(document)).toContain("No findings yet");
      expect(statusOf(document)).toBe("Waiting for code.");
    } finally {
      void window.close();
    }
  });

  it("analyses a prefilled buffer after the debounce and updates the toolbar", async () => {
    const { window, document } = liveDom("package main");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return {
        ok: true,
        language: "go",
        results: [{ ...findingFor("solid.srp"), language: "go" }],
      };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      expect(calls).toEqual([]);

      await tick(30);

      expect(calls).toEqual([{ sourceCode: "package main", filename: undefined }]);
      expect(resultsOf(document)).toContain("solid.srp");
      expect(resultsOf(document)).toContain("1 finding: 1 compliant");
      expect(statusOf(document)).toBe("Findings up to date.");
      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "Go",
      );
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 1 line",
      );
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "snippet.go",
      );
    } finally {
      void window.close();
    }
  });

  it("counts several lines in the toolbar meta", async () => {
    const { window, document } = liveDom("package main\n// a second line");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return { ok: true, language: "go", results: [] };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(calls).toHaveLength(1);
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 2 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("shows the analysing state while a run is in flight", async () => {
    const { window, document } = liveDom("package main");
    let resolveRun!: (outcome: LiveOutcome) => void;
    const pending = new Promise<LiveOutcome>((resolve) => {
      resolveRun = resolve;
    });
    const analyze: AnalyzeBuffer = async () => pending;

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(20);

      expect(statusOf(document)).toBe("Analyzing…");
      expect(resultsOf(document)).toContain('class="skeleton"');
      expect(resultsOf(document)).toContain('class="progress-line"');

      resolveRun({ ok: true, language: "go", results: [] });
      await tick();

      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("analyses an unidentified buffer as unknown without parking", async () => {
    const { window, document } = liveDom("hello world");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return {
        ok: true,
        language: "unknown",
        results: [{ ...findingFor("solid.srp"), language: "unknown" }],
      };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(calls).toHaveLength(1);
      expect(resultsOf(document)).toContain("solid.srp");
      expect(statusOf(document)).toBe("Findings up to date.");
      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "Unknown",
      );
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Unknown · 1 line",
      );
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "snippet.txt",
      );
      expect(document.querySelector("#analyze-error")?.tagName ?? null).toBe(
        null,
      );
    } finally {
      void window.close();
    }
  });

  it("collapses rapid input into one request for the latest buffer", async () => {
    const { window, document, textarea } = liveDom("");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return { ok: true, language: "go", results: [] };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 20)).toBe(true);

      textarea.value = "package";
      textarea.dispatchEvent(inputEvent(window));
      textarea.value = "package main";
      textarea.dispatchEvent(inputEvent(window));
      await tick(50);

      expect(calls).toEqual([
        { sourceCode: "package main", filename: undefined },
      ]);
      expect(statusOf(document)).toBe("Findings up to date.");
      expect(resultsOf(document)).toContain("no rules were available");
    } finally {
      void window.close();
    }
  });

  it("does not re-analyse an unchanged buffer", async () => {
    const { window, document, textarea } = liveDom("package main");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return { ok: true, language: "go", results: [] };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);
      expect(calls).toHaveLength(1);

      textarea.dispatchEvent(inputEvent(window));
      await tick(30);

      expect(calls).toHaveLength(1);
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("renders the empty state when the buffer is cleared during the debounce", async () => {
    const { window, document, textarea } = liveDom("package main");
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return { ok: true, language: "go", results: [] };
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 30)).toBe(true);
      await tick(50);
      expect(calls).toHaveLength(1);

      // A new pause starts for the longer buffer, then the buffer is
      // cleared with no event — so the armed run reads the blank buffer
      // itself rather than the schedule shortcut.
      textarea.value = "package main\n// more";
      textarea.dispatchEvent(inputEvent(window));
      textarea.value = "   ";
      await tick(50);

      expect(calls).toHaveLength(1);
      expect(resultsOf(document)).toContain("No findings yet");
      expect(statusOf(document)).toBe("Waiting for code.");
    } finally {
      void window.close();
    }
  });

  it("parks an in-flight run when the buffer is cleared", async () => {
    const { window, document, textarea } = liveDom("package main");
    let resolveRun!: (outcome: LiveOutcome) => void;
    const pending = new Promise<LiveOutcome>((resolve) => {
      resolveRun = resolve;
    });
    const calls: RecordedCall[] = [];
    const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return pending;
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(20);
      expect(calls).toHaveLength(1);

      textarea.value = "";
      textarea.dispatchEvent(inputEvent(window));

      resolveRun({ ok: true, language: "go", results: [findingFor("x")] });
      await tick();

      expect(resultsOf(document)).toContain("No findings yet");
      expect(statusOf(document)).toBe("Waiting for code.");
    } finally {
      void window.close();
    }
  });

  it("lets only the latest run render when responses arrive out of order", async () => {
    const { window, document, textarea } = liveDom("");
    const calls: RecordedCall[] = [];
    const resolvers: ((outcome: LiveOutcome) => void)[] = [];
    const analyze: AnalyzeBuffer = (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      return new Promise<LiveOutcome>((resolve) => {
        resolvers.push(resolve);
      });
    };

    try {
      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);

      textarea.value = "package";
      textarea.dispatchEvent(inputEvent(window));
      await tick(20);
      textarea.value = "package main";
      textarea.dispatchEvent(inputEvent(window));
      await tick(20);
      expect(calls).toHaveLength(2);

      resolvers[1]?.({
        ok: true,
        language: "go",
        results: [findingFor("solid.dip")],
      });
      await tick();
      resolvers[0]?.({
        ok: true,
        language: "go",
        results: [findingFor("solid.srp")],
      });
      await tick();

      expect(resultsOf(document)).toContain("solid.dip");
      expect(resultsOf(document)).not.toContain("solid.srp");
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("shows a server rejection and parks the loop", async () => {
    const { window, document } = liveDom("hello world");
    const calls: RecordedCall[] = [];

    try {
      const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
        calls.push({ sourceCode, filename });
        return {
          ok: false,
          error: "sourceCode must not be empty.",
          language: "unknown",
        };
      };

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(calls).toHaveLength(1);
      expect(resultsOf(document)).toContain(
        '<div class="notice"><p>sourceCode must not be empty.</p></div>',
      );
      expect(statusOf(document)).toBe("Analysis paused — see below.");
      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "Unknown",
      );
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Unknown · 1 line",
      );
    } finally {
      void window.close();
    }
  });

  it("shows the empty-run state when no rule produced a finding", async () => {
    const { window, document } = liveDom("package main");

    try {
      const analyze: AnalyzeBuffer = async () => ({
        ok: true,
        language: "go",
        results: [],
      });

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(resultsOf(document)).toContain("No findings");
      expect(resultsOf(document)).toContain("no rules were available");
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("clears a stale validation banner once the run succeeds", async () => {
    const { window, document, textarea } = liveDom("package main");

    try {
      textarea.setAttribute("aria-invalid", "true");
      textarea.setAttribute("aria-describedby", "analyze-error");
      const banner = document.createElement("div");
      banner.className = "field__error";
      banner.id = "analyze-error";
      banner.setAttribute("role", "alert");
      banner.textContent = "Could not detect the programming language.";
      const form = document.querySelector("form#analyzeForm");
      form?.before(banner);

      const analyze: AnalyzeBuffer = async () => ({
        ok: true,
        language: "go",
        results: [],
      });

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(document.querySelector("#analyze-error")?.tagName ?? null).toBe(
        null,
      );
      expect(textarea.hasAttribute("aria-invalid")).toBe(false);
      expect(textarea.hasAttribute("aria-describedby")).toBe(false);
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("prefers the real example filename over the derived snippet name", async () => {
    const { window, document } = liveDom("irrelevant", {
      exampleFilename: "UserService.ts",
    });

    try {
      const analyze: AnalyzeBuffer = async () => ({
        ok: true,
        language: "typescript",
        results: [],
      });

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
    } finally {
      void window.close();
    }
  });

  it("still renders when the toolbar optionals and the file input are absent", async () => {
    const { window, document } = liveDom("package main", {
      withoutOptionals: true,
    });

    try {
      const analyze: AnalyzeBuffer = async () => ({
        ok: true,
        language: "go",
        results: [findingFor("solid.srp")],
      });

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);

      expect(resultsOf(document)).toContain("solid.srp");
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });

  it("reads an uploaded file into the editor and analyses it with its name", async () => {
    const { window, document } = liveDom("stale text");
    const calls: RecordedCall[] = [];
    // Bubbled input events: the editor island re-renders off the same
    // dispatch the island emits after filling the textarea.
    let bubbledInputs = 0;

    try {
      const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
        calls.push({ sourceCode, filename });
        return { ok: true, language: "python", results: [] };
      };

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);
      expect(calls).toHaveLength(1);

      const form = document.querySelector("form#analyzeForm");
      form?.addEventListener("input", () => {
        bubbledInputs += 1;
      });

      const fileInput = document.querySelector("#sourceFile");
      const file = new window.File(["def greet(name):"], "main.py", {
        type: "text/plain",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });
      fileInput?.dispatchEvent(changeEvent(window));
      await tick(30);

      const textarea = document.querySelector(
        "#sourceCode",
      ) as unknown as HTMLTextAreaElement;
      expect(textarea.value).toBe("def greet(name):");
      expect(bubbledInputs).toBeGreaterThan(0);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual({
        sourceCode: "def greet(name):",
        filename: "main.py",
      });
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Python · 1 line",
      );
    } finally {
      void window.close();
    }
  });

  it("analyses the edited buffer when the file picker is cancelled", async () => {
    const { window, document, textarea } = liveDom("package main");
    const calls: RecordedCall[] = [];

    try {
      const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
        calls.push({ sourceCode, filename });
        return { ok: true, language: "go", results: [] };
      };

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);
      expect(calls).toHaveLength(1);

      // Edited with no event, so only the picker's own schedule can
      // analyse the new buffer — a crash there would analyse nothing.
      textarea.value = "package main\n// edited";
      const fileInput = document.querySelector("#sourceFile");
      Object.defineProperty(fileInput, "files", {
        value: null,
        configurable: true,
      });
      fileInput?.dispatchEvent(changeEvent(window));
      await tick(30);

      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual({
        sourceCode: "package main\n// edited",
        filename: undefined,
      });
    } finally {
      void window.close();
    }
  });

  it("parks the loop when the uploaded file cannot be read", async () => {
    const { window, document } = liveDom("package main");
    const calls: RecordedCall[] = [];

    try {
      const analyze: AnalyzeBuffer = async (sourceCode, filename) => {
        calls.push({ sourceCode, filename });
        return { ok: true, language: "go", results: [] };
      };

      expect(enhanceLiveAnalysis(document, analyze, 5)).toBe(true);
      await tick(30);
      expect(calls).toHaveLength(1);

      const fileInput = document.querySelector("#sourceFile");
      Object.defineProperty(fileInput, "files", {
        value: [
          {
            name: "main.py",
            text: () => Promise.reject(new Error("unreadable")),
          },
        ],
        configurable: true,
      });
      fileInput?.dispatchEvent(changeEvent(window));
      await tick(30);

      expect(calls).toHaveLength(1);
      expect(resultsOf(document)).toContain(
        "Could not reach the analysis service",
      );
      expect(statusOf(document)).toBe("Analysis paused — see below.");
    } finally {
      void window.close();
    }
  });

  it("analyses the filled buffer after an example switch without navigating", async () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<form id="analyzeForm">` +
        `<span id="editorFilename">snippet.txt</span>` +
        `<span id="editorLanguage" data-language="">Auto-detect</span>` +
        `<div class="editor__stage">` +
        `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `</div>` +
        `<p id="editorMeta"></p>` +
        `<div class="editor__gutter" aria-hidden="true"></div>` +
        `<input id="sourceFile" name="sourceFile" type="file">` +
        `</form>` +
        `<section class="results-live"><div id="liveResults" aria-live="polite"></div></section>` +
        `<p class="analyze-status" id="analyzeStatus" role="status">Waiting for code.</p>` +
        `<section class="examples"><div class="button-row">` +
        `<a class="button" href="/analyze?example=single-responsibility">Single Responsibility</a>` +
        `</div></section>` +
        `</div>`;

      const detectCalls: string[] = [];
      expect(
        enhanceAnalyzeEditor(document, async (sourceCode) => {
          detectCalls.push(sourceCode);
          return "typescript";
        }),
      ).toBe(true);

      const calls: RecordedCall[] = [];
      expect(
        enhanceLiveAnalysis(document, async (sourceCode, filename) => {
          calls.push({ sourceCode, filename });
          return { ok: true, language: "typescript", results: [] };
        }, 5),
      ).toBe(true);
      expect(detectCalls).toEqual([]);

      const link = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      const event = clickEvent(window);
      link?.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);

      await tick(40);

      expect(calls).toHaveLength(1);
      expect(calls[0]?.sourceCode).toContain("sendWelcomeEmail");
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
      expect(statusOf(document)).toBe("Findings up to date.");
    } finally {
      void window.close();
    }
  });
});
