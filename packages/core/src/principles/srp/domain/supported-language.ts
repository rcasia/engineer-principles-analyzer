/**
 * Languages this rule knows how to find class-shaped constructs in.
 *
 * A short, explicit allow-list rather than a reject-list on purpose: SRP's
 * usual framing — cohesion inside one class — presumes a language that
 * groups state and behaviour into classes at all. A language this rule
 * does not recognise is not assumed to need that shape or to violate it
 * (#10's "does not assume one OO style is correct for every language");
 * `SrpRule` reports `not_applicable` for it instead of guessing.
 */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set([
  "typescript",
  "javascript",
]);

export function isSupportedLanguage(language: string): boolean {
  return SUPPORTED_LANGUAGES.has(language.trim().toLowerCase());
}
