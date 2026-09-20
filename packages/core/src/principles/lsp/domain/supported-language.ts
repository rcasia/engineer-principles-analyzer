/**
 * Languages this rule knows how to find class hierarchies in.
 *
 * A short, explicit allow-list rather than a reject-list on purpose:
 * substitutability through `class … extends …` is a TypeScript/JavaScript
 * shape. A language this rule does not recognise is not assumed to need
 * that shape or to violate it; `LspRule` reports `not_applicable` for it
 * instead of guessing.
 */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  "typescript",
  "javascript",
]);

export function isSupportedLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.has(language.trim().toLowerCase());
}
