/**
 * Display names and file extensions per detector-produced language, shared
 * by the server-rendered playground and the live client island so both
 * agree on what a detected language is called and which filename it gets.
 * Dependency-free on purpose: the browser bundle must not drag in the
 * design-system CSS string or any other presentation module.
 */

const LANGUAGE_DETAILS: Readonly<
  Record<string, { readonly label: string; readonly extension: string }>
> = {
  typescript: { label: "TypeScript", extension: "ts" },
  javascript: { label: "JavaScript", extension: "js" },
  python: { label: "Python", extension: "py" },
  go: { label: "Go", extension: "go" },
  rust: { label: "Rust", extension: "rs" },
  java: { label: "Java", extension: "java" },
};

/** Shown wherever a language would appear but detection has nothing yet. */
export const AUTO_DETECT_LABEL = "Auto-detect";

/**
 * Shown when detection produced no language for a non-empty buffer. The
 * visitor cannot override it. Lives here — not in `server.ts` — so the
 * server rejection path and the client validation echo read the same
 * literal, by construction rather than by review.
 */
export const UNDETECTED_LANGUAGE_MESSAGE =
  "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.";

function canonicalLanguage(language: string): string {
  return language.trim().toLowerCase();
}

/** Display name for a detector-produced language; "" renders as auto-detect. */
export function languageLabel(language: string): string {
  if (canonicalLanguage(language) === "") {
    return AUTO_DETECT_LABEL;
  }

  return LANGUAGE_DETAILS[canonicalLanguage(language)]?.label ?? language;
}

export function extensionFor(language: string): string {
  return LANGUAGE_DETAILS[canonicalLanguage(language)]?.extension ?? "txt";
}
