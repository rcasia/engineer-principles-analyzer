/**
 * Live language detection and syntax highlighting for the `/analyze`
 * playground (ADR-0029, detection via POST /detect per ADR-0028).
 *
 * Progressive enhancement only: the form submits and the server detects
 * without any of this running. When the bundle loads, the island
 * highlights with the server-rendered language (`data-language` on the
 * badge) and asks POST /detect — the same Jev judgment the server uses on
 * submit — on paste and when a buffer loads unknown. Never per keystroke:
 * typing only re-highlights and re-counts locally, so the credential stays
 * server-side and one paste costs one call.
 *
 * The Phase 2 validation echo (#50) rides on the same state: every render
 * also syncs the server's rejection wording for the current buffer and
 * language, so an empty or undetectable buffer is flagged without a submit
 * round trip. The echo itself adds no network call; the server still
 * re-validates every submission.
 *
 * Everything DOM-touching degrades to `false` when its elements are absent
 * (SSR output, scripting disabled, other pages).
 */
import hljs from "highlight.js/lib/core";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import {
  extensionFor,
  languageLabel,
} from "../presentation/language-display.ts";
import { hydrateGutter } from "./gutter.ts";
import { byTag } from "./dom.ts";
import { syncValidationEcho } from "./validation-echo.ts";

type LanguageDefinition = Parameters<typeof hljs.registerLanguage>[1];

const HIGHLIGHT_LANGUAGES: Readonly<Record<string, LanguageDefinition>> = {
  typescript,
  javascript,
  python,
  go,
  rust,
  java,
};

for (const [name, definition] of Object.entries(HIGHLIGHT_LANGUAGES)) {
  hljs.registerLanguage(name, definition);
}

/** One language lookup: buffer plus optional filename hint. */
export type DetectLanguage = (
  sourceCode: string,
  filename: string | undefined,
) => Promise<string>;

/**
 * Asks the server for one buffer's language. Never throws: any failure —
 * network, status, or shape — resolves to `""`, so the badge keeps showing
 * auto-detect instead of breaking the island.
 */
export async function fetchLanguage(
  sourceCode: string,
  filename: string | undefined,
  fetchFn: typeof fetch,
): Promise<string> {
  try {
    const response = await fetchFn("/detect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceCode, filename: filename ?? "" }),
    });

    if (!response.ok) {
      return "";
    }

    const payload: unknown = await response.json();
    const language =
      typeof payload === "object" && payload !== null
        ? (payload as { readonly language?: unknown }).language
        : undefined;

    return typeof language === "string" ? language : "";
  } catch {
    return "";
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Highlighted markup for a buffer: highlight.js spans for a detected
 * language, escaped plaintext otherwise. Unknown languages cannot reach
 * `highlight`, which throws for unregistered names — hence the membership
 * check rather than a try/catch.
 */
export function highlightedHtml(
  sourceCode: string,
  language: string,
): string {
  if (hljs.getLanguage(language) !== undefined) {
    return hljs.highlight(sourceCode, { language }).value;
  }

  return escapeHtml(sourceCode);
}

/** Toolbar filename: the real example name, else derived from detection. */
export function toolbarFilename(
  language: string,
  exampleFilename: string | undefined,
): string {
  if (exampleFilename !== undefined) {
    return exampleFilename;
  }

  return `snippet.${extensionFor(language)}`;
}

function lineCountLabel(sourceCode: string): string {
  if (sourceCode.length === 0) {
    return "0 lines";
  }

  const count = sourceCode.split("\n").length;

  return count === 1 ? "1 line" : `${count} lines`;
}

interface EditorElements {
  readonly form: HTMLFormElement;
  readonly textarea: HTMLTextAreaElement;
  readonly backdrop: HTMLElement;
  readonly badge: HTMLElement;
  readonly filename: HTMLElement;
  readonly meta: HTMLElement;
  readonly gutter: HTMLElement | null;
  readonly fileInput: HTMLInputElement | null;
  readonly exampleFilename: string | undefined;
}

/** Mutable island state: the language the badge currently shows. */
interface EditorState {
  language: string;
}

/** Uploaded filename, or `undefined` when no file is chosen. */
export function selectedFilename(
  fileInput: {
    readonly files: ArrayLike<{ readonly name: string }> | null | undefined;
  } | null,
): string | undefined {
  return fileInput?.files?.[0]?.name;
}

function render(elements: EditorElements, language: string): void {
  const sourceCode = elements.textarea.value;

  elements.backdrop.innerHTML = `${highlightedHtml(sourceCode, language)}\n`;
  elements.badge.textContent = languageLabel(language);
  elements.filename.textContent = toolbarFilename(
    language,
    elements.exampleFilename,
  );
  elements.meta.textContent = `${languageLabel(language)} · ${lineCountLabel(sourceCode)}`;

  hydrateGutter(elements.gutter, sourceCode);
  syncValidationEcho(elements.form, sourceCode, language);

  elements.backdrop.scrollTop = elements.textarea.scrollTop;
  elements.backdrop.scrollLeft = elements.textarea.scrollLeft;
}

/**
 * Re-asks the server for the buffer's language, then re-renders. A
 * rejecting lookup resolves to auto-detect rather than breaking the
 * island — the badge is a preview, the submit verdict is authoritative.
 */
async function refreshLanguage(
  elements: EditorElements,
  state: EditorState,
  detect: DetectLanguage,
): Promise<void> {
  try {
    state.language = await detect(
      elements.textarea.value,
      selectedFilename(elements.fileInput),
    );
  } catch {
    state.language = "";
  }

  render(elements, state.language);
}

/**
 * Enhances the server-rendered playground in place. Returns `true` when an
 * editor was found and wired, `false` without touching anything otherwise.
 *
 * `detect` is injected so tests script the lookup: production passes a
 * `fetchLanguage` call, keeping the credential server-side.
 */
export function enhanceAnalyzeEditor(
  root: Document | Element,
  detect: DetectLanguage,
): boolean {
  const form = byTag<HTMLFormElement>(root, "form#analyzeForm", "FORM");

  if (form === null) {
    return false;
  }

  const textarea = byTag<HTMLTextAreaElement>(form, "#sourceCode", "TEXTAREA");
  const backdrop = byTag<HTMLElement>(form, "#sourceHighlight", "CODE");
  const badge = byTag<HTMLElement>(form, "#editorLanguage", "SPAN");
  const filename = byTag<HTMLElement>(form, "#editorFilename", "SPAN");
  const meta = byTag<HTMLElement>(form, "#editorMeta", "P");

  if (
    textarea === null ||
    backdrop === null ||
    badge === null ||
    filename === null ||
    meta === null
  ) {
    return false;
  }

  const state: EditorState = { language: badge.dataset["language"] ?? "" };
  const elements: EditorElements = {
    form,
    textarea,
    backdrop,
    badge,
    filename,
    meta,
    gutter: byTag<HTMLElement>(form, ".editor__gutter", "DIV"),
    fileInput: byTag<HTMLInputElement>(form, "#sourceFile", "INPUT"),
    exampleFilename: form.dataset["exampleFilename"],
  };

  render(elements, state.language);
  backdrop.closest(".editor__stage")?.classList.add("editor--live");

  if (elements.textarea.value.trim().length > 0 && state.language === "") {
    void refreshLanguage(elements, state, detect);
  }

  textarea.addEventListener("input", () => render(elements, state.language));
  textarea.addEventListener("paste", () => {
    // The paste lands after this event: defer the lookup a task so it
    // reads the pasted buffer, not the pre-paste one.
    globalThis.setTimeout(() => {
      void refreshLanguage(elements, state, detect);
    }, 0);
  });
  textarea.addEventListener("scroll", () => {
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  });
  elements.fileInput?.addEventListener("change", () =>
    render(elements, state.language),
  );

  return true;
}

if (typeof document !== "undefined") {
  enhanceAnalyzeEditor(
    document,
    (sourceCode, filename) =>
      fetchLanguage(sourceCode, filename, globalThis.fetch),
  );
}
