/**
 * Languages this rule knows how to find extension signals in.
 *
 * A short, explicit allow-list rather than a reject-list on purpose: the
 * branching constructs this rule counts (`switch`, `else if`, `typeof`,
 * `instanceof`) are TypeScript/JavaScript-shaped. A language this rule does
 * not recognise is not assumed to need that shape or to violate it;
 * `OcpRule` reports `not_applicable` for it instead of guessing.
 */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  "typescript",
  "javascript",
]);

export function isSupportedLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.has(language.trim().toLowerCase());
}
