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
