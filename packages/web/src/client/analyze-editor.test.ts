import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  editorLanguageOf,
  enhanceAnalyzeEditor,
  highlightedHtml,
  selectedFilename,
  toolbarFilename,
} from "./analyze-editor.ts";

describe("editorLanguageOf", () => {
  it("detects python from pasted content", () => {
    expect(editorLanguageOf("def greet(name):\n    print(name)", undefined)).toBe(
      "python",
    );
  });

  it("detects go from pasted content", () => {
    expect(editorLanguageOf("package main", undefined)).toBe("go");
  });

  it("detects typescript from content signals", () => {
    expect(
      editorLanguageOf("interface Foo { readonly name: string }", undefined),
    ).toBe("typescript");
  });

  it("prefers the uploaded filename over content", () => {
    expect(editorLanguageOf("hello world", "main.py")).toBe("python");
  });

  it("returns empty for an ambiguous snippet", () => {
    expect(editorLanguageOf("class Foo {}", undefined)).toBe("");
  });

  it("returns empty for an empty buffer", () => {
    expect(editorLanguageOf("", undefined)).toBe("");
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

describe("selectedFilename", () => {
  it("returns undefined without a file input", () => {
    expect(selectedFilename(null)).toBe(undefined);
  });

  it("returns undefined when the input exposes no files", () => {
    expect(selectedFilename({ files: undefined })).toBe(undefined);
    expect(selectedFilename({ files: null })).toBe(undefined);
  });

  it("returns undefined when no file is chosen", () => {
    expect(selectedFilename({ files: { length: 0 } })).toBe(undefined);
  });

  it("returns the chosen filename", () => {
    expect(
      selectedFilename({ files: { length: 1, 0: { name: "main.py" } } }),
    ).toBe("main.py");
  });

  it("returns undefined when the entry has no name", () => {
    expect(selectedFilename({ files: { length: 1 } })).toBe(undefined);
  });
});

/** happy-dom events are not the DOM lib's `Event`; the cast keeps `dispatchEvent` happy. */
function inputEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("input", { bubbles: true }) as unknown as Event;
}

function scrollEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("scroll", { bubbles: true }) as unknown as Event;
}

function changeEvent(window: InstanceType<typeof Window>): Event {
  return new window.Event("change", { bubbles: true }) as unknown as Event;
}

function editorDom(sourceCode: string): {
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
    `<span id="editorLanguage">Auto-detect</span>` +
    `<div class="editor__stage">` +
    `<pre class="editor__backdrop" aria-hidden="true"><code id="sourceHighlight"></code></pre>` +
    `<textarea id="sourceCode" name="sourceCode"></textarea>` +
    `</div>` +    `<p id="editorMeta"></p>` +
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

describe("enhanceAnalyzeEditor", () => {
  it("detects and highlights the loaded buffer on init", () => {
    const { window, document } = editorDom(
      "def greet(name):\n    print(name)",
    );

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
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

  it("re-detects on every keystroke", () => {
    const { window, document, textarea } = editorDom("class Foo {}");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Auto-detect");

      textarea.value = "package main";
      textarea.dispatchEvent(inputEvent(window));

      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
      expect(
        document.querySelector("#sourceHighlight")?.innerHTML,
      ).toContain("hljs-");
      expect(document.querySelector("#editorMeta")?.textContent).toBe(
        "Go · 1 line",
      );
    } finally {
      void window.close();
    }
  });

  it("derives the snippet filename once the example no longer applies", () => {
    const { window, document, textarea } = editorDom(
      "def greet(name):\n    print(name)",
    );

    try {
      document
        .querySelector("#analyzeForm")
        ?.removeAttribute("data-example-filename");

      expect(enhanceAnalyzeEditor(document)).toBe(true);

      textarea.value = "class Foo {}";
      textarea.dispatchEvent(inputEvent(window));

      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "snippet.txt",
      );
    } finally {
      void window.close();
    }
  });

  it("detects from the uploaded filename when content is ambiguous", () => {
    const { window, document } = editorDom("hello world");

    try {
      const fileInput = document.querySelector("#sourceFile");
      const file = new window.File(["hello world"], "main.py", {
        type: "text/plain",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });

      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Python");
      expect(document.querySelector("#editorFilename")?.textContent).toBe(
        "UserService.ts",
      );
    } finally {
      void window.close();
    }
  });

  it("re-detects when the visitor picks a file", () => {
    const { window, document } = editorDom("hello world");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Auto-detect");

      const fileInput = document.querySelector("#sourceFile");
      const file = new window.File(["hello world"], "main.go", {
        type: "text/plain",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });
      fileInput?.dispatchEvent(changeEvent(window));

      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("marks the stage live so the overlay styles apply", () => {
    const { window, document } = editorDom("package main");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector(".editor__stage")?.classList.contains(
          "editor--live",
        ),
      ).toBe(true);
    } finally {
      void window.close();
    }
  });

  it("keeps the backdrop tall for an empty buffer", () => {
    const { window, document } = editorDom("");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
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

  it("enhances without a gutter element", () => {
    const { window, document } = editorDom("package main");

    try {
      document.querySelector(".editor__gutter")?.remove();

      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("enhances without a file input", () => {
    const { window, document } = editorDom("package main");

    try {
      document.querySelector("#sourceFile")?.remove();

      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("enhances without a stage wrapper", () => {
    const { window, document } = editorDom("package main");

    try {
      const stage = document.querySelector(".editor__stage");
      const parent = stage?.parentElement;

      if (parent !== null && parent !== undefined && stage !== null) {
        while (stage.firstChild !== null) {
          parent.insertBefore(stage.firstChild, stage);
        }

        stage.remove();
      }

      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector("#editorLanguage")?.textContent,
      ).toBe("Go");
    } finally {
      void window.close();
    }
  });

  it("keeps the backdrop scroll in sync with the textarea", () => {
    const { window, document, textarea } = editorDom("package main");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
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

  it("updates the gutter line numbers with the buffer", () => {
    const { window, document } = editorDom("a\nb\nc");

    try {
      expect(enhanceAnalyzeEditor(document)).toBe(true);
      expect(
        document.querySelector(".editor__gutter")?.innerHTML,
      ).toBe("<span>1</span><span>2</span><span>3</span>");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without an analyze form", () => {
    const window = new Window();

    try {
      expect(
        enhanceAnalyzeEditor(window.document as unknown as Document),
      ).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the backdrop is missing", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      const host = document.createElement("div");
      host.innerHTML =
        `<form id="analyzeForm">` +
        `<textarea id="sourceCode" name="sourceCode"></textarea>` +
        `</form>`;
      document.body.appendChild(host);

      expect(enhanceAnalyzeEditor(document)).toBe(false);
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

      expect(enhanceAnalyzeEditor(document)).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the source field is not a textarea", () => {
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

      expect(enhanceAnalyzeEditor(document)).toBe(false);
    } finally {
      void window.close();
    }
  });
});
