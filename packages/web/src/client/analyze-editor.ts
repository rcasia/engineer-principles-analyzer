/**
 * Live language detection and syntax highlighting for the `/analyze`
 * playground (ADR-0027).
 *
 * Progressive enhancement only: the form submits and the server detects
 * without any of this running. When the bundle loads, the island detects
 * the buffer on every keystroke with the same core `detectLanguage` the
 * server uses — so the badge never disagrees with the analysis — and
 * colours the code with highlight.js behind a transparent textarea.
 *
 * Everything DOM-touching degrades to `false` when its elements are absent
 * (SSR output, scripting disabled, other pages).
 */
import { detectLanguage } from "@principled/core";
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

/** Detector-produced language for a buffer, "" when nothing recognisable. */
export function editorLanguageOf(
  sourceCode: string,
  filename: string | undefined,
): string {
  return detectLanguage(sourceCode, filename) ?? "";
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
  readonly textarea: HTMLTextAreaElement;
  readonly backdrop: HTMLElement;
  readonly badge: HTMLElement;
  readonly filename: HTMLElement;
  readonly meta: HTMLElement;
  readonly gutter: HTMLElement | null;
  readonly fileInput: HTMLInputElement | null;
  readonly exampleFilename: string | undefined;
}

/**
 * Looks up one element by tag: `querySelector` alone cannot tell a
 * `<div id="sourceCode">` from the real textarea, and the island must not
 * wire the wrong node. Returns `null` for a missing or mistagged element.
 */
function byTag<T extends Element>(
  parent: Document | Element,
  selector: string,
  tag: string,
): T | null {
  const found = parent.querySelector(selector);

  if (found === null || found.tagName !== tag) {
    return null;
  }

  return found as T;
}

/** Uploaded filename, or `undefined` when no file is chosen. */
export function selectedFilename(
  fileInput: {
    readonly files: ArrayLike<{ readonly name: string }> | null | undefined;
  } | null,
): string | undefined {
  return fileInput?.files?.[0]?.name;
}

function render(elements: EditorElements): void {
  const sourceCode = elements.textarea.value;
  const language = editorLanguageOf(
    sourceCode,
    selectedFilename(elements.fileInput),
  );

  elements.backdrop.innerHTML = `${highlightedHtml(sourceCode, language)}\n`;
  elements.badge.textContent = languageLabel(language);
  elements.filename.textContent = toolbarFilename(
    language,
    elements.exampleFilename,
  );
  elements.meta.textContent = `${languageLabel(language)} · ${lineCountLabel(sourceCode)}`;

  hydrateGutter(elements.gutter, sourceCode);

  elements.backdrop.scrollTop = elements.textarea.scrollTop;
  elements.backdrop.scrollLeft = elements.textarea.scrollLeft;
}

/**
 * Enhances the server-rendered playground in place. Returns `true` when an
 * editor was found and wired, `false` without touching anything otherwise.
 */
export function enhanceAnalyzeEditor(root: Document | Element): boolean {
  const form = byTag<HTMLElement>(root, "form#analyzeForm", "FORM");

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

  const elements: EditorElements = {
    textarea,
    backdrop,
    badge,
    filename,
    meta,
    gutter: byTag<HTMLElement>(form, ".editor__gutter", "DIV"),
    fileInput: byTag<HTMLInputElement>(form, "#sourceFile", "INPUT"),
    exampleFilename: form.dataset["exampleFilename"],
  };

  render(elements);
  backdrop.closest(".editor__stage")?.classList.add("editor--live");
  textarea.addEventListener("input", () => render(elements));
  textarea.addEventListener("scroll", () => {
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  });
  elements.fileInput?.addEventListener("change", () => render(elements));

  return true;
}

if (typeof document !== "undefined") {
  enhanceAnalyzeEditor(document);
}
