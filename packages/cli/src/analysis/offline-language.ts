/**
 * Offline language resolution for the CLI (#43, ADR-0028, ADR-0040).
 *
 * The web adapter judges the submission language with Jev, which needs a
 * network connection and an API key. The CLI is offline-first — no account,
 * no network, no telemetry — so it resolves the language without any
 * judgment call: an explicit `--language` wins, otherwise the file name's
 * extension names it, otherwise analysis proceeds as `"unknown"` instead of
 * blocking (ADR-0040). There are deliberately no content heuristics here:
 * extension lookup is a statement of intent by the caller, not a guess
 * about code.
 *
 * The six languages match the closed option set the web detector judges
 * between, so whenever both adapters settle on the same language the
 * shared engine produces identical findings (#20). `"unknown"` is the
 * non-blocking fallback both adapters share: heuristic rules analyze recognizable
 * constructs generically (ADR-0044) while Jev-backed rules judge generically.
 */
import { UNKNOWN_LANGUAGE } from "@principled/core";

export { UNKNOWN_LANGUAGE };
export const KNOWN_LANGUAGES: readonly string[] = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
];

const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  pyw: "python",
  go: "go",
  rs: "rust",
  java: "java",
};

/**
 * The language implied by a filename's extension, or `undefined` when the
 * name carries no recognised extension. Only the text after the final dot
 * of the base name counts.
 */
export function languageForFilename(filename: string): string | undefined {
  // String.split never returns an empty array, so both pops are always
  // defined; the assertions only narrow the type, they cannot fail.
  const base = filename.split("/").pop()!.split("\\").pop()!;
  const dot = base.lastIndexOf(".");

  if (dot <= 0) {
    return undefined;
  }

  return EXTENSION_TO_LANGUAGE[base.slice(dot + 1).toLowerCase()];
}

export interface LanguageInput {
  /** Explicit `--language` value, if one was given. */
  readonly language?: string | undefined;
  /** File path the source was read from, if any. Hints detection only. */
  readonly filename?: string | undefined;
}

export type ResolvedLanguage =
  | { readonly ok: true; readonly language: string }
  | { readonly ok: false; readonly message: string };

export function resolveLanguage(input: LanguageInput): ResolvedLanguage {
  const explicit = input.language?.trim();

  if (explicit !== undefined && explicit.length > 0) {
    const normalized = explicit.toLowerCase();
    if (normalized === UNKNOWN_LANGUAGE) {
      return { ok: true, language: UNKNOWN_LANGUAGE };
    }
    if (!KNOWN_LANGUAGES.includes(normalized)) {
      return {
        ok: false,
        message: `Unknown language: ${explicit}. Expected one of typescript, javascript, python, go, rust, java.`,
      };
    }

    return { ok: true, language: normalized };
  }

  const fromFilename =
    input.filename === undefined
      ? undefined
      : languageForFilename(input.filename);

  if (fromFilename !== undefined) {
    return { ok: true, language: fromFilename };
  }

  return { ok: true, language: UNKNOWN_LANGUAGE };
}
