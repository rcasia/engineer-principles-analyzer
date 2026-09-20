/**
 * Extension-pressure signals for the Open/Closed Principle rule (#11):
 * `switch` statements, `else if` chains, and `typeof`/`instanceof` type
 * guards — every one a place where new behaviour most plausibly arrives by
 * editing existing branches rather than by adding new code.
 *
 * Counts are taken over noise-stripped source (strings, template literals
 * and comments blanked, newlines preserved), so a `switch` inside a string
 * or a comment is never read as a branch. This is deliberately not a real
 * parser: `@principled/core` ships no runtime dependencies (ADR-0008), and
 * the SOLID rules are heuristic by design (ADR-0022).
 */

export interface BranchSignals {
  readonly switches: number;
  readonly elseIfs: number;
  readonly typeGuards: number;
  readonly total: number;
}

/** Longest excerpt `locateFirstSignal` will attach to a finding. */
export const MAX_EXCERPT_LENGTH = 120;

/**
 * `sourceCode` with every string literal, template literal and comment
 * replaced by spaces, keeping `\n` where it was so line numbers still line
 * up with the original. Code characters pass through untouched.
 */
export function stripNoise(sourceCode: string): string {
  let result = "";
  let i = 0;

  while (i < sourceCode.length) {
    const char = sourceCode[i];
    const next = sourceCode[i + 1];

    if (char === '"' || char === "'") {
      const end = skipQuoted(sourceCode, i, char as string);
      result += blanked(sourceCode, i, end);
      i = end;
      continue;
    }

    if (char === "`") {
      const end = skipTemplate(sourceCode, i);
      result += blanked(sourceCode, i, end);
      i = end;
      continue;
    }

    if (char === "/" && next === "/") {
      const end = skipLineComment(sourceCode, i);
      result += blanked(sourceCode, i, end);
      i = end;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = skipBlockComment(sourceCode, i);
      result += blanked(sourceCode, i, end);
      i = end;
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
}

function blanked(source: string, start: number, end: number): string {
  return source
    .slice(start, end)
    .replace(/[^\n]/g, " ");
}

function skipQuoted(source: string, start: number, quote: string): number {
  let i = start + 1;

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (source[i] !== undefined) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }

    if (source[i] === quote) {
      return i + 1;
    }

    i += 1;
  }

  return source.length;
}

function skipTemplate(source: string, start: number): number {
  let i = start + 1;

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (source[i] !== undefined) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }

    if (source[i] === "`") {
      return i + 1;
    }

    i += 1;
  }

  return source.length;
}

function skipLineComment(source: string, start: number): number {
  const end = source.indexOf("\n", start);

  return end === -1 ? source.length : end;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);

  return end === -1 ? source.length : end + 2;
}

function countMatches(haystack: string, pattern: RegExp): number {
  return (haystack.match(pattern) ?? []).length;
}

/**
 * Counts extension signals in `sourceCode`, ignoring anything inside a
 * string, template literal or comment. `typeGuards` is the sum of `typeof`
 * and `instanceof` occurrences; `total` is the sum of all three groups.
 */
export function countBranchSignals(sourceCode: string): BranchSignals {
  const stripped = stripNoise(sourceCode);
  const switches = countMatches(stripped, /\bswitch\b/g);
  const elseIfs = countMatches(stripped, /\belse\s+if\b/g);
  const typeGuards =
    countMatches(stripped, /\btypeof\b/g) +
    countMatches(stripped, /\binstanceof\b/g);

  return { switches, elseIfs, typeGuards, total: switches + elseIfs + typeGuards };
}

const SIGNAL_LINE_PATTERN = /\bswitch\b|\belse\s+if\b|\btypeof\b|\binstanceof\b/;

export interface SignalLocation {
  readonly startLine: number;
  readonly excerpt: string;
}

/**
 * The first noise-stripped line containing an extension signal, with its
 * original (unblanked) text trimmed and capped at
 * {@link MAX_EXCERPT_LENGTH} characters — the minimal evidence a finding
 * can point at. `undefined` when the subject has no signal at all.
 */
export function locateFirstSignal(
  sourceCode: string,
): SignalLocation | undefined {
  const strippedLines = stripNoise(sourceCode).split("\n");
  const originalLines = sourceCode.split("\n");

  for (const [i, stripped] of strippedLines.entries()) {
    if (SIGNAL_LINE_PATTERN.test(stripped)) {
      const text = (originalLines[i] as string).trim();

      return { startLine: i + 1, excerpt: text.slice(0, MAX_EXCERPT_LENGTH) };
    }
  }

  return undefined;
}
