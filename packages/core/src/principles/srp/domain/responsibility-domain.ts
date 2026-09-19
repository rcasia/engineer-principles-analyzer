/**
 * A fixed, deliberately small dictionary of keyword groups a method name's
 * words are checked against.
 *
 * This is the weakest link in the heuristic and is disclosed as such (see
 * `SrpRule`'s `limitations`): a method whose name uses none of these words
 * contributes to no domain, and a codebase with different naming
 * conventions (a different natural language, a house style that avoids
 * verbs) will under-report. It is a starting, versioned dictionary
 * (ADR-0022), not a claim of completeness — expanding it does not change
 * this rule's contract, only its recall, so it can grow independently of
 * `AnalysisResult`'s shape.
 */
const RESPONSIBILITY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  persistence: [
    "save",
    "load",
    "delete",
    "insert",
    "update",
    "remove",
    "fetch",
    "query",
    "find",
    "persist",
    "store",
    "read",
    "write",
  ],
  communication: [
    "send",
    "notify",
    "publish",
    "subscribe",
    "email",
    "sms",
    "broadcast",
    "emit",
    "dispatch",
  ],
  presentation: ["render", "display", "print", "format", "draw", "show"],
  validation: ["validate", "verify", "check", "ensure", "assert"],
  calculation: ["calculate", "compute", "sum", "aggregate", "total"],
  authentication: [
    "authenticate",
    "authorize",
    "login",
    "logout",
    "signin",
    "signout",
  ],
  serialization: [
    "serialize",
    "deserialize",
    "parse",
    "stringify",
    "encode",
    "decode",
  ],
  logging: ["log", "trace", "audit"],
};

/**
 * A domain counts as a real signal only once at least this many methods
 * match it — one incidentally-named method (a `logError` helper in an
 * otherwise cohesive class) is not evidence of a second responsibility.
 */
export const MINIMUM_METHODS_PER_DOMAIN = 2;

/**
 * Splits `camelCase`/`snake_case`/`PascalCase` method names into lowercase
 * words. Exported so its edge cases (leading/trailing separators producing
 * no empty word) are directly testable, rather than only observable
 * indirectly through {@link classifyResponsibilityDomains}.
 *
 * Splits on one literal space rather than `/\s+/` on purpose: consecutive
 * separators (e.g. `"save__user"`) leave empty fragments behind, and the
 * `filter` below is what removes them — a single `split`/`filter` pair
 * with no `+` quantifier anywhere, so there is no "one-or-more vs exactly
 * one" mutant of this function that the visible output could not
 * distinguish.
 */
export function wordsOf(methodName: string): ReadonlySet<string> {
  const spaced = methodName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ");

  return new Set(
    spaced
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 0),
  );
}

export interface DomainMatch {
  readonly domain: string;
  readonly methodNames: readonly string[];
}

/**
 * Groups `methodNames` by which responsibility domain their words match,
 * keeping only domains with at least {@link MINIMUM_METHODS_PER_DOMAIN}
 * matches. A method whose name matches more than one domain's keywords
 * (`saveAndNotify`) legitimately counts toward both — that is itself a
 * signal the name may be doing two things.
 */
export function classifyResponsibilityDomains(
  methodNames: readonly string[],
): readonly DomainMatch[] {
  const byDomain = new Map<string, string[]>();

  for (const methodName of methodNames) {
    const words = wordsOf(methodName);

    for (const [domain, keywords] of Object.entries(RESPONSIBILITY_KEYWORDS)) {
      if (keywords.some((keyword) => words.has(keyword))) {
        const matched = byDomain.get(domain) ?? [];
        matched.push(methodName);
        byDomain.set(domain, matched);
      }
    }
  }

  return [...byDomain.entries()]
    .filter(([, matched]) => matched.length >= MINIMUM_METHODS_PER_DOMAIN)
    .map(([domain, matched]) => ({ domain, methodNames: matched }));
}
