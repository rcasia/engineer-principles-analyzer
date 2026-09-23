import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  enhanceAnalyzeEditor,
  fetchLanguage,
  highlightedHtml,
  toolbarFilename,
  type DetectLanguage,
} from "./analyze-editor.ts";

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

describe("fetchLanguage", () => {
  it("posts the buffer as JSON and returns the detected language", async () => {
    const { fetchFn, calls } = stubFetch(() =>
      jsonResponse({ language: "python" }),
    );

    const language = await fetchLanguage(
      "def greet(name):",
      "main.py",
      fetchFn,
    );

    expect(language).toBe("python");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/detect");
    expect(calls[0]?.init).toEqual({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceCode: "def greet(name):", filename: "main.py" }),
    });
  });

  it("sends an empty filename when none is given", async () => {
    const { fetchFn, calls } = stubFetch(() => jsonResponse({ language: "go" }));

    await fetchLanguage("package main", undefined, fetchFn);

    expect((calls[0]?.init as { body?: string }).body).toBe(
      JSON.stringify({ sourceCode: "package main", filename: "" }),
    );
  });

  it("passes an unknown verdict through as empty", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse({ language: "" }));

    await expect(
      fetchLanguage("hello world", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty on a non-ok status", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse({ language: "go" }, 500));

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty when the request fails", async () => {
    const fetchFn = (() =>
      Promise.reject(new Error("connection reset"))) as unknown as typeof fetch;

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty when the body is not JSON", async () => {
    const { fetchFn } = stubFetch(
      () => new Response("not json", { status: 200 }),
    );

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty for a null body", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse(null));

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty for a non-object body", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse("go"));

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });

  it("resolves empty for a non-string language", async () => {
    const { fetchFn } = stubFetch(() => jsonResponse({ language: 7 }));

    await expect(
      fetchLanguage("package main", undefined, fetchFn),
    ).resolves.toBe("");
  });
});

describe("highlightedHtml", () => {
  it("wraps typescript keywords in highlight spans", () => {
    const html = highlightedHtml(
      "interface Foo { readonly name: string }",
      "typescript",
    );

    expect(html).toContain('<span class="hljs-keyword">interface</span>');
  });

  it("highlights python for a detected python buffer", () => {
    const html = highlightedHtml("def greet(name):\n    print(name)", "python");

    expect(html).toContain("hljs-");
    expect(html).not.toContain("&lt;");
  });

  it("renders escaped plaintext when nothing was detected", () => {
    expect(highlightedHtml("class Foo {}", "")).toBe("class Foo {}");
  });

  it("escapes hostile code in the plaintext path", () => {
    const html = highlightedHtml('a&b<"c">', "");

    expect(html).toBe("a&amp;b&lt;&quot;c&quot;&gt;");
    expect(html).not.toContain('a&b<"c">');
  });

  it("never throws on half-typed code mid-keystroke", () => {
    expect(() =>
      highlightedHtml("export class UserService { async", "typescript"),
    ).not.toThrow();
  });

  it("falls back to plaintext for an unregistered language", () => {
    expect(highlightedHtml("print 'hi'", "haskell")).toBe("print 'hi'");
  });
});

describe("toolbarFilename", () => {
  it("keeps the real example filename", () => {
    expect(toolbarFilename("typescript", "UserService.ts")).toBe(
      "UserService.ts",
    );
  });

  it("derives a snippet name from the detected language", () => {
    expect(toolbarFilename("python", undefined)).toBe("snippet.py");
  });

  it("falls back to plain text without detection", () => {
    expect(toolbarFilename("", undefined)).toBe("snippet.txt");
  });

  it("derives a snippet name without example data", () => {
    expect(toolbarFilename("go", undefined)).toBe("snippet.go");
  });
});

/** happy-dom events are not the DOM lib's `Event`; the cast keeps `dispatchEvent` happy. */
function inputEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("input", { bubbles: true }) as unknown as Event;
}

function pasteEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("paste", { bubbles: true }) as unknown as Event;
}

function scrollEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("scroll", { bubbles: true }) as unknown as Event;
}

function changeEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("change", { bubbles: true }) as unknown as Event;
}

function editorDom(
  sourceCode: string,
  initialLanguage = "",
): {
  window: InstanceType<typeof Window>;
  document: Document;
  textarea: HTMLTextAreaElement;
} {
  const window = new Window();
  const document = window.document as unknown as Document;
  const host = document.createElement("div");
  host.innerHTML =
    `<form id="analyzeForm" data-example-filename="UserService.ts">` +
    `<span id="editorFilename">UserService.ts</span>` +
    `<span id="editorLanguage" data-language="${initialLanguage}">Auto-detect</span>` +
    `<div class="editor__stage">` +
    `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
    `<textarea id="sourceCode" name="sourceCode"></textarea>` +
    `</div>` + `<p id="editorMeta"></p>` +
    `<div class="editor__gutter" aria-hidden="true"></div>` +
    `<input id="sourceFile" name="sourceFile" type="file">` +
    `</form>`;
  document.body.appendChild(host);
  const textarea = host.querySelector(
    "#sourceCode",
  ) as unknown as HTMLTextAreaElement;
  textarea.value = sourceCode;

  return { window, document, textarea };
}

function awaitTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

interface RecordedCall {
  readonly sourceCode: string;
  readonly filename: string | undefined;
}

function scriptedDetect(
  language: string,
  calls: RecordedCall[],
): DetectLanguage {
  return async (sourceCode, filename) => {
    calls.push({ sourceCode, filename });
    return language;
  };
}

/** A lookup that must never run: no-op paths return before detection. */
function neverDetect(): DetectLanguage {
  return () => Promise.reject(new Error("detect must not run"));
}

describe("enhanceAnalyzeEditor", () => {
  it("renders the server language on init without detecting", async () => {
    const { window, document } = editorDom(
      "def greet(name):\n    print(name)",
      "python",
    );
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("go", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Python");
      expect(
        document.querySelector("#sourceHighlight")?.innerHTML,
      ).toContain("hljs-");
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Python · 2 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("detects once when a buffer loads unknown", async () => {
    const { window, document } = editorDom("def greet(name):\n    print(name)");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([
        { sourceCode: "def greet(name):\n    print(name)", filename: undefined },
      ]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Python");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Python · 2 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("sends the uploaded filename with a load-time lookup", async () => {
    const { window, document } = editorDom("hello world");
    const calls: RecordedCall[] = [];

    try {
      const fileInput = document.querySelector("#sourceFile");
      const file = new window.File(["hello world"], "main.py", {
        type: "text/plain",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });

      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([
        { sourceCode: "hello world", filename: "main.py" },
      ]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Python");
    } finally {
      void window.close();
    }
  });

  it("makes no lookup for an empty buffer", async () => {
    const { window, document } = editorDom("");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("go", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([]);
      expect(
        document.querySelector("#sourceHighlight")?.innerHTML,
      ).toBe("\n");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Auto-detect · 0 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("makes no lookup for a whitespace-only buffer", async () => {
    const { window, document } = editorDom("   ");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("go", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([]);
    } finally {
      void window.close();
    }
  });

  it("starts unknown without a data-language attribute", async () => {
    const { window, document } = editorDom("");
    const calls: RecordedCall[] = [];

    try {
      document
        .querySelector("#editorLanguage")
        ?.removeAttribute("data-language");

      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("go", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toEqual([]);
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Auto-detect · 0 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("detects on paste and reads the pasted buffer", async () => {
    const { window, document, textarea } = editorDom(
      "interface Foo {}",
      "typescript",
    );
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);
      await awaitTick();
      expect(calls).toEqual([]);

      // Browser order: the paste event fires before the value lands.
      textarea.dispatchEvent(pasteEvent(window));
      textarea.value = "def greet(name):";
      await awaitTick();

      expect(calls).toEqual([
        { sourceCode: "def greet(name):", filename: undefined },
      ]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Python");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Python · 1 line",
      );
      expect(
        document.querySelector("#sourceHighlight")?.innerHTML,
      ).toContain("hljs-");
    } finally {
      void window.close();
    }
  });

  it("does not detect on keystroke input", async () => {
    const { window, document, textarea } = editorDom(
      "package main",
      "go",
    );
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);

      textarea.value = "package main\n// typed";
      textarea.dispatchEvent(inputEvent(window));
      await awaitTick();

      expect(calls).toEqual([]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 2 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("does not detect when the visitor picks a file", async () => {
    const { window, document, textarea } = editorDom("hello world", "go");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);

      const fileInput = document.querySelector("#sourceFile");
      const file = new window.File(["hello world"], "main.go", {
        type: "text/plain",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });
      textarea.value = "hello\nworld\nagain";
      fileInput?.dispatchEvent(changeEvent(window));
      await awaitTick();

      expect(calls).toEqual([]);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 3 lines",
      );
    } finally {
      void window.close();
    }
  });

  it("keeps auto-detect when the lookup rejects", async () => {
    const { window, document } = editorDom("package main");
    const calls: RecordedCall[] = [];
    const failing: DetectLanguage = async (sourceCode, filename) => {
      calls.push({ sourceCode, filename });
      throw new Error("boom");
    };

    try {
      expect(enhanceAnalyzeEditor(document, failing)).toBe(true);
      await awaitTick();

      expect(calls).toHaveLength(1);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Auto-detect");
    } finally {
      void window.close();
    }
  });

  it("resets to auto-detect when a later lookup rejects", async () => {
    const { window, document, textarea } = editorDom("package main", "go");
    const failing: DetectLanguage = async () => {
      throw new Error("boom");
    };

    try {
      expect(enhanceAnalyzeEditor(document, failing)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");

      textarea.dispatchEvent(pasteEvent(window));
      textarea.value = "def greet(name):";
      await awaitTick();

      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Auto-detect");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Auto-detect · 1 line",
      );
    } finally {
      void window.close();
    }
  });

  it("derives the snippet filename once the example no longer applies", async () => {
    const { window, document } = editorDom("def greet(name):\n    print(name)");
    const calls: RecordedCall[] = [];

    try {
      document
        .querySelector("#analyzeForm")
        ?.removeAttribute("data-example-filename");

      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);
      await awaitTick();

      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "snippet.py",
      );
    } finally {
      void window.close();
    }
  });

  it("marks the stage live so the overlay styles apply", async () => {
    const { window, document } = editorDom("package main", "go");

    try {
      expect(enhanceAnalyzeEditor(document, scriptedDetect("go", []))).toBe(
        true,
      );
      expect(
        document.querySelector(".editor__stage")?.classList.contains(
          "editor--live",
        ),
      ).toBe(true);
    } finally {
      void window.close();
    }
  });

  it("enhances without a file input", async () => {
    const { window, document } = editorDom("package main", "go");

    try {
      document.querySelector("#sourceFile")?.remove();

      expect(enhanceAnalyzeEditor(document, scriptedDetect("python", []))).toBe(
        true,
      );
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("enhances without a stage wrapper", async () => {
    const { window, document } = editorDom("package main", "go");

    try {
      const stage = document.querySelector(".editor__stage");
      const parent = stage?.parentElement;

      if (parent !== null && parent !== undefined && stage !== null) {
        while (stage.firstChild !== null) {
          parent.insertBefore(stage.firstChild, stage);
        }

        stage.remove();
      }

      expect(enhanceAnalyzeEditor(document, scriptedDetect("python", []))).toBe(
        true,
      );
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("keeps the backdrop scroll in sync with the textarea", async () => {
    const { window, document, textarea } = editorDom("package main", "go");

    try {
      expect(enhanceAnalyzeEditor(document, scriptedDetect("go", []))).toBe(true);
      const backdrop = document.querySelector(
        "#sourceHighlight",
      ) as unknown as HTMLElement;

      textarea.scrollTop = 42;
      textarea.scrollLeft = 7;
      textarea.dispatchEvent(scrollEvent(window));

      expect(backdrop.scrollTop).toBe(42);
      expect(backdrop.scrollLeft).toBe(7);
    } finally {
      void window.close();
    }
  });

  it("updates the gutter line numbers with the buffer", async () => {
    const { window, document, textarea } = editorDom("a\nb\nc", "go");

    try {
      expect(enhanceAnalyzeEditor(document, scriptedDetect("go", []))).toBe(true);
      await awaitTick();

      textarea.value = "a\nb";
      textarea.dispatchEvent(inputEvent(window));

      expect(
        document.querySelector(".editor__gutter")?.innerHTML,
      ).toBe("<span>1</span><span>2</span>");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without an analyze form", async () => {
    const window = new Window();

    try {
      expect(
        enhanceAnalyzeEditor(window.document as unknown as Document, neverDetect()),
      ).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the backdrop is missing", async () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      const host = document.createElement("div");
      host.innerHTML =
        `<form id="analyzeForm">` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `</form>`;
      document.body.appendChild(host);

      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(false);
    } finally {
      void window.close();
    }
  });

  it.each([
    ["sourceCode"],
    ["sourceHighlight"],
    ["editorLanguage"],
    ["editorFilename"],
    ["editorMeta"],
  ])("is a no-op when #%p is missing", (id) => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      const host = document.createElement("div");
      host.innerHTML =
        `<form id="analyzeForm">` +
        `<span id="editorFilename">snippet.txt</span>` +
        `<span id="editorLanguage">Auto-detect</span>` +
        `<pre aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `<p id="editorMeta"></p>` +
        `</form>`;
      document.body.appendChild(host);
      host.querySelector(`#${id}`)?.remove();

      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the source field is not a textarea", async () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      const host = document.createElement("div");
      host.innerHTML =
        `<form id="analyzeForm">` +
        `<span id="editorFilename">snippet.txt</span>` +
        `<span id="editorLanguage">Auto-detect</span>` +
        `<pre aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
        `<div id="sourceCode"></div>` +
        `<p id="editorMeta"></p>` +
        `</form>`;
      document.body.appendChild(host);

      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(false);
    } finally {
      void window.close();
    }
  });
});


describe("validation echo", () => {
  it("shows the server's empty message without a round trip or a lookup", () => {
    const { window, document } = editorDom("");

    try {
      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(true);

      const banner = document.querySelector("#analyze-error");
      expect(banner?.tagName).toBe("DIV");
      expect(banner?.getAttribute("role")).toBe("alert");
      expect(banner?.textContent).toBe("sourceCode must not be empty.");

      const textarea = document.querySelector("#sourceCode");
      expect(textarea?.getAttribute("aria-invalid")).toBe("true");
      expect(textarea?.getAttribute("aria-describedby")).toBe(
        "analyze-error",
      );
    } finally {
      void window.close();
    }
  });

  it("stays silent when the lookup draws a blank, which now runs as unknown", async () => {
    const { window, document } = editorDom("class Foo {}");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("", calls)),
      ).toBe(true);
      await awaitTick();

      expect(calls).toHaveLength(1);
      expect(document.querySelector("#analyze-error")).toBe(null);
    } finally {
      void window.close();
    }
  });

  it("clears the echo once a paste resolves to a language", async () => {
    const { window, document, textarea } = editorDom("");
    const calls: RecordedCall[] = [];

    try {
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("python", calls)),
      ).toBe(true);
      expect(document.querySelector("#analyze-error")?.textContent).toBe(
        "sourceCode must not be empty.",
      );

      textarea.value = "def greet(name):\n    print(name)";
      textarea.dispatchEvent(pasteEvent(window));
      await awaitTick();
      await awaitTick();

      expect(document.querySelector("#analyze-error")).toBe(null);
      expect(textarea.hasAttribute("aria-invalid")).toBe(false);
      expect(textarea.hasAttribute("aria-describedby")).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("stays silent when the server rendered a known language", () => {
    const { window, document } = editorDom(
      "def greet(name):\n    print(name)",
      "python",
    );

    try {
      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(true);
      expect(document.querySelector("#analyze-error")).toBe(null);
    } finally {
      void window.close();
    }
  });
});

describe("example switching", () => {
  it("re-renders synchronously on switch, before any language lookup settles", async () => {
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
        `<section class="examples"><div class="button-row">` +
        `<a class="button" href="/analyze?example=single-responsibility">Single Responsibility</a>` +
        `</div></section>` +
        `</div>`;

      const calls: RecordedCall[] = [];
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("typescript", calls)),
      ).toBe(true);

      const link = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      const event = new window.Event("click", {
        bubbles: true,
        cancelable: true,
      }) as unknown as Event;
      link?.dispatchEvent(event);

      // No tick: the language lookup has not settled, so only the
      // synchronous re-render can have updated the toolbar and backdrop.
      expect(event.defaultPrevented).toBe(true);
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
      expect(
        document.querySelector("#sourceHighlight")?.textContent,
      ).toContain("sendWelcomeEmail");

      await awaitTick();

      expect(calls).toHaveLength(1);
      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "TypeScript",
      );
    } finally {
      void window.close();
    }
  });

  it("fills the editor and refreshes the language without navigating", async () => {
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
        `<section class="examples"><div class="button-row">` +
        `<a class="button" href="/analyze?example=single-responsibility">Single Responsibility</a>` +
        `</div></section>` +
        `</div>`;

      const calls: RecordedCall[] = [];
      expect(
        enhanceAnalyzeEditor(document, scriptedDetect("typescript", calls)),
      ).toBe(true);
      expect(document.querySelector("#analyze-error")?.textContent).toBe(
        "sourceCode must not be empty.",
      );

      const link = document.querySelector(
        'a[href="/analyze?example=single-responsibility"]',
      );
      const event = new window.Event("click", {
        bubbles: true,
        cancelable: true,
      }) as unknown as Event;
      link?.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(
        (document.querySelector("#sourceCode") as unknown as HTMLTextAreaElement)
          .value,
      ).toContain("sendWelcomeEmail");

      await awaitTick();

      expect(calls).toHaveLength(1);
      expect(calls[0]?.sourceCode).toContain("sendWelcomeEmail");
      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "TypeScript",
      );
      expect(document.querySelector("#analyze-error")).toBe(null);
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
      expect(link?.getAttribute("aria-current")).toBe("true");
    } finally {
      void window.close();
    }
  });
});

describe("hydration mismatch", () => {
  it("leaves a mismatched page byte-identical without touching anything", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<form id="analyzeForm">` +
        `<span id="editorFilename">snippet.txt</span>` +
        `<span id="editorLanguage" data-language="">Auto-detect</span>` +
        `<div class="editor__stage">` +
        `<pre class="editor__backdrop" aria-hidden="true"><div id="sourceHighlight"></div></pre>` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `</div>` +
        `<p id="editorMeta"></p>` +
        `<div class="editor__gutter" aria-hidden="true"></div>` +
        `</form>` +
        `</div>`;
      const before = document.body.innerHTML;

      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(false);
      expect(document.body.innerHTML).toBe(before);
      expect(document.querySelector("#analyze-error")).toBe(null);
      expect(
        document.querySelector(".editor__stage")?.classList.contains(
          "editor--live",
        ),
      ).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("tolerates a mistagged gutter, wiring everything else", async () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<form id="analyzeForm">` +
        `<span id="editorFilename">snippet.txt</span>` +
        `<span id="editorLanguage" data-language="go">Auto-detect</span>` +
        `<div class="editor__stage">` +
        `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `</div>` +
        `<p id="editorMeta"></p>` +
        `<span class="editor__gutter">stale</span>` +
        `</form>` +
        `</div>`;
      const gutterBefore = document.querySelector(".editor__gutter")
        ?.innerHTML;

      expect(enhanceAnalyzeEditor(document, neverDetect())).toBe(true);
      await awaitTick();

      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "Go",
      );
      expect(document.querySelector(".editor__gutter")?.innerHTML).toBe(
        gutterBefore,
      );
      // The empty buffer still echoes: a known language never excuses it,
      // exactly as an empty submission 400s server side.
      expect(document.querySelector("#analyze-error")?.textContent).toBe(
        "sourceCode must not be empty.",
      );
    } finally {
      void window.close();
    }
  });
});

describe("module auto-enhancement", () => {
  let importCount = 0;

  it("enhances the playground on load when a document exists", async () => {
    const window = new Window();
    const document = window.document as unknown as Document;
    document.body.innerHTML =
      `<form id="analyzeForm">` +
      `<span id="editorFilename">snippet.txt</span>` +
      `<span id="editorLanguage" data-language="">Auto-detect</span>` +
      `<div class="editor__stage">` +
      `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
      `<textarea id="sourceCode" name="sourceCode">package main</textarea>` +
      `</div>` +
      `<p id="editorMeta"></p>` +
      `<div class="editor__gutter" aria-hidden="true"></div>` +
      `<input id="sourceFile" name="sourceFile" type="file">` +
      `</form>`;

    const globals = globalThis as unknown as Record<string, unknown>;
    const previousDocument = globals["document"];
    const previousFetch = globals["fetch"];
    globals["document"] = document;
    globals["fetch"] = (async () =>
      jsonResponse({ language: "go" })) as unknown as typeof fetch;

    try {
      importCount += 1;
      await import(`./analyze-editor.ts?auto-init=${importCount}`);
      await awaitTick();
      await awaitTick();

      expect(document.querySelector("#editorLanguage")?.textContent).toBe(
        "Go",
      );
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 1 line",
      );
      expect(
        document.querySelector(".editor__stage")?.classList.contains(
          "editor--live",
        ),
      ).toBe(true);
    } finally {
      if (previousDocument === undefined) {
        delete globals["document"];
      } else {
        globals["document"] = previousDocument;
      }

      globals["fetch"] = previousFetch;
      void window.close();
    }
  });
});
