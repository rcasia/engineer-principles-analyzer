/**
 * Languages this rule knows how to find interface-shaped constructs in.
 *
 * A short, explicit allow-list rather than a reject-list on purpose: the
 * `interface`/`type` object shapes this rule reads are
 * TypeScript/JavaScript constructs. A language this rule does not
 * recognise is not assumed to need that shape or to violate it;
 * `IspRule` reports `not_applicable` for it instead of guessing.
 */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  "typescript",
  "javascript",
]);

export function isSupportedLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.has(language.trim().toLowerCase());
}
