import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  syncValidationEcho,
  VALIDATION_ERROR_ID,
  validationMessageOf,
} from "./validation-echo.ts";

const EMPTY_MESSAGE = "sourceCode must not be empty.";
const UNDETECTED_MESSAGE =
  "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.";

describe("validationMessageOf", () => {
  it("reports the empty buffer exactly as the server rejection does", () => {
    expect(validationMessageOf("", "")).toBe(EMPTY_MESSAGE);
  });

  it("reports an empty buffer even when a language is known", () => {
    expect(validationMessageOf("", "python")).toBe(EMPTY_MESSAGE);
  });

  it("reports whitespace as empty, matching the submission path", () => {
    expect(validationMessageOf("   ", "")).toBe(EMPTY_MESSAGE);
  });

  it("reports the detection failure for a buffer with no language", () => {
    expect(validationMessageOf("class Foo {}", "")).toBe(UNDETECTED_MESSAGE);
  });

  it("stays silent for a buffer the server would accept", () => {
    expect(
      validationMessageOf("def greet(name):\n    print(name)", "python"),
    ).toBe(undefined);
  });

  it("stays silent for a single accepted line", () => {
    expect(validationMessageOf("package main", "go")).toBe(undefined);
  });
});

function echoDom(options?: {
  readonly banner?: string;
  readonly textareaTag?: string;
}): {
  window: InstanceType<typeof Window>;
  document: Document;
  form: HTMLFormElement;
  textarea: Element | null;
} {
  const window = new Window();
  const document = window.document as unknown as Document;
  const banner =
    options?.banner === undefined
      ? ""
      : `<div class="field__error" id="analyze-error" role="alert">${options.banner}</div>`;
  const textareaTag = options?.textareaTag ?? "textarea";

  document.body.innerHTML =
    `<div>` +
    banner +
    `<form id="analyzeForm">` +
    `<${textareaTag} id="sourceCode" name="sourceCode"></${textareaTag}>` +
    `</form>` +
    `</div>`;

  const form = document.querySelector(
    "form#analyzeForm",
  ) as unknown as HTMLFormElement;

  return {
    window,
    document,
    form,
    textarea: document.querySelector("#sourceCode"),
  };
}

describe("syncValidationEcho", () => {
  it("creates an alert banner with the empty message for an empty buffer", () => {
    const { window, form } = echoDom();

    try {
      expect(syncValidationEcho(form, "", "")).toBe(true);

      const banner = form.parentElement?.querySelector(
        `#${VALIDATION_ERROR_ID}`,
      );
      expect(banner?.tagName).toBe("DIV");
      expect(banner?.className).toBe("field__error");
      expect(banner?.getAttribute("role")).toBe("alert");
      expect(banner?.textContent).toBe(EMPTY_MESSAGE);

      const textarea = form.querySelector("#sourceCode");
      expect(textarea?.getAttribute("aria-invalid")).toBe("true");
      expect(textarea?.getAttribute("aria-describedby")).toBe(
        VALIDATION_ERROR_ID,
      );
      expect(VALIDATION_ERROR_ID).toBe("analyze-error");
    } finally {
      void window.close();
    }
  });

  it("echoes the detection failure without a server round trip", () => {
    const { window, form } = echoDom();

    try {
      expect(syncValidationEcho(form, "class Foo {}", "")).toBe(true);
      expect(
        form.parentElement?.querySelector(`#${VALIDATION_ERROR_ID}`)
          ?.textContent,
      ).toBe(UNDETECTED_MESSAGE);
    } finally {
      void window.close();
    }
  });

  it("adopts a server-rendered banner in place instead of duplicating it", () => {
    const { window, document, form } = echoDom({ banner: "stale words" });

    try {
      const before = document.querySelector(`#${VALIDATION_ERROR_ID}`);
      expect(syncValidationEcho(form, "", "")).toBe(true);
      expect(
        document.querySelectorAll(`#${VALIDATION_ERROR_ID}`),
      ).toHaveLength(1);
      const banner = document.querySelector(`#${VALIDATION_ERROR_ID}`);
      expect(banner).toBe(before);
      expect(banner?.tagName).toBe("DIV");
      expect(banner?.className).toBe("field__error");
      expect(banner?.getAttribute("role")).toBe("alert");
      expect(
        document.querySelector(`#${VALIDATION_ERROR_ID}`)?.textContent,
      ).toBe(EMPTY_MESSAGE);
    } finally {
      void window.close();
    }
  });

  it("replaces a mistagged banner impostor with the server markup", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<span id="analyze-error">stale words</span>` +
        `<form id="analyzeForm"><textarea id="sourceCode" name="sourceCode"></textarea></form>` +
        `</div>`;
      const form = document.querySelector(
        "form#analyzeForm",
      ) as unknown as HTMLFormElement;

      expect(syncValidationEcho(form, "", "")).toBe(true);
      expect(
        document.querySelectorAll(`#${VALIDATION_ERROR_ID}`),
      ).toHaveLength(1);
      expect(
        document.querySelector(`#${VALIDATION_ERROR_ID}`)?.tagName,
      ).toBe("DIV");
      expect(
        document.querySelector(`#${VALIDATION_ERROR_ID}`)?.textContent,
      ).toBe(EMPTY_MESSAGE);
    } finally {
      void window.close();
    }
  });

  it("removes the banner and the invalid markers once the buffer is valid", () => {
    const { window, document, form } = echoDom({ banner: EMPTY_MESSAGE });

    try {
      expect(
        syncValidationEcho(
          form,
          "def greet(name):\n    print(name)",
          "python",
        ),
      ).toBe(true);
      expect(document.querySelector(`#${VALIDATION_ERROR_ID}`)).toBe(null);

      const textarea = form.querySelector("#sourceCode");
      expect(textarea?.hasAttribute("aria-invalid")).toBe(false);
      expect(textarea?.hasAttribute("aria-describedby")).toBe(false);
    } finally {
      void window.close();
    }
  });

  it("never writes visitor source into the echo", () => {
    const { window, document, form } = echoDom();

    try {
      expect(
        syncValidationEcho(form, '<script>alert(1)</script>', ""),
      ).toBe(true);

      const banner = document.querySelector(`#${VALIDATION_ERROR_ID}`);
      expect(banner?.textContent).toBe(UNDETECTED_MESSAGE);
      expect(document.querySelectorAll("script")).toHaveLength(0);
      expect(document.body.innerHTML).not.toContain("<script>alert(1)");
    } finally {
      void window.close();
    }
  });

  it("is a no-op without a form", () => {
    expect(syncValidationEcho(null, "", "")).toBe(false);
  });

  it("scopes to the document when the form has no parent element", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      const form = document.createElement("form") as unknown as HTMLFormElement;
      form.id = "analyzeForm";
      form.innerHTML = `<textarea id="sourceCode" name="sourceCode"></textarea>`;
      expect(form.parentElement).toBe(null);

      expect(syncValidationEcho(form, "", "")).toBe(true);

      const textarea = form.querySelector("#sourceCode");
      expect(textarea?.getAttribute("aria-invalid")).toBe("true");
      expect(textarea?.getAttribute("aria-describedby")).toBe(
        VALIDATION_ERROR_ID,
      );
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the form itself is mistagged, leaving the page untouched", () => {
    const window = new Window();

    try {
      const document = window.document as unknown as Document;
      document.body.innerHTML =
        `<div>` +
        `<div id="analyzeForm"><textarea id="sourceCode" name="sourceCode"></textarea></div>` +
        `</div>`;
      const impostor = document.querySelector(
        "#analyzeForm",
      ) as unknown as HTMLFormElement;
      expect(impostor.tagName).toBe("DIV");
      const before = document.body.innerHTML;

      expect(syncValidationEcho(impostor, "", "")).toBe(false);
      expect(document.body.innerHTML).toBe(before);
      expect(document.querySelector(`#${VALIDATION_ERROR_ID}`)).toBe(null);
    } finally {
      void window.close();
    }
  });

  it("is a no-op when the source field is mistagged, leaving the page untouched", () => {
    const { window, document, form } = echoDom({ textareaTag: "div" });

    try {
      const before = document.body.innerHTML;

      expect(syncValidationEcho(form, "", "")).toBe(false);
      expect(document.body.innerHTML).toBe(before);
      expect(document.querySelector(`#${VALIDATION_ERROR_ID}`)).toBe(null);
    } finally {
      void window.close();
    }
  });
});
