/**
 * A minimal, dependency-free lexer used by the SRP rule (#10) to find brace
 * boundaries in TypeScript/JavaScript-shaped source without mistaking a
 * brace inside a string, template literal, or comment for real structure.
 *
 * Deliberately not a real parser: `@principled/core` ships no runtime
 * dependencies (ADR-0008), and the SOLID rules are heuristic by design
 * (ADR-0022) — "good enough to find class/method boundaries in
 * conventionally-formatted source", not "correct for every valid program".
 * Constructs this cannot express (nested template interpolation containing
 * unbalanced braces inside a further nested template, for instance) are a
 * known, accepted gap; see ADR-0022's limitations.
 */

/**
 * Given `code[index]` is the first character of a string, template literal,
 * or comment, returns the index just past it. For any other character,
 * returns `index + 1` — the caller never needs to special-case "nothing to
 * skip" separately from "skipped one plain character".
 */
export function nextSignificantIndex(code: string, index: number): number {
  const char = code[index];

  if (char === '"' || char === "'") {
    return skipQuoted(code, index, char);
  }

  if (char === "`") {
    return skipTemplateLiteral(code, index);
  }

  if (char === "/" && code[index + 1] === "/") {
    return skipLineComment(code, index);
  }

  if (char === "/" && code[index + 1] === "*") {
    return skipBlockComment(code, index);
  }

  return index + 1;
}

function skipQuoted(code: string, start: number, quote: string): number {
  let i = start + 1;

  while (i < code.length) {
    if (code[i] === "\\") {
      i += 2;
      continue;
    }

    if (code[i] === quote) {
      return i + 1;
    }

    i += 1;
  }

  return code.length;
}

function skipTemplateLiteral(code: string, start: number): number {
  let i = start + 1;
  let interpolationDepth = 0;

  while (i < code.length) {
    if (code[i] === "\\") {
      i += 2;
      continue;
    }

    if (code[i] === "`" && interpolationDepth === 0) {
      return i + 1;
    }

    if (code[i] === "$" && code[i + 1] === "{") {
      interpolationDepth += 1;
      i += 2;
      continue;
    }

    if (code[i] === "}" && interpolationDepth > 0) {
      interpolationDepth -= 1;
      i += 1;
      continue;
    }

    i += 1;
  }

  return code.length;
}

function skipLineComment(code: string, start: number): number {
  const end = code.indexOf("\n", start);

  return end === -1 ? code.length : end;
}

function skipBlockComment(code: string, start: number): number {
  const end = code.indexOf("*/", start + 2);

  return end === -1 ? code.length : end + 2;
}

/**
 * The index of the first `{` at or after `fromIndex` that is real code, or
 * `-1` if none exists (e.g. an ambient `declare class Foo;` with no body).
 */
export function findNextUnquotedBrace(code: string, fromIndex: number): number {
  let i = fromIndex;

  while (i < code.length) {
    if (code[i] === "{") {
      return i;
    }

    i = nextSignificantIndex(code, i);
  }

  return -1;
}

/**
 * Given `code[openBraceIndex]` is `{`, returns the index of its matching
 * `}`, or `-1` if the braces never balance (malformed or truncated input).
 */
export function findMatchingBrace(code: string, openBraceIndex: number): number {
  let depth = 1;
  let i = openBraceIndex + 1;

  while (i < code.length) {
    const char = code[i];

    if (char === "{") {
      depth += 1;
      i += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return i;
      }

      i += 1;
      continue;
    }

    i = nextSignificantIndex(code, i);
  }

  return -1;
}

/**
 * The text of `code[start:end]` with every comment removed but every
 * string/template literal preserved verbatim.
 *
 * Used to build the "header" text a member signature is matched against:
 * a comment sitting between two class members (`// note\n  foo() {}`) is
 * not part of either member's signature, so it must not survive into the
 * text {@link METHOD_HEADER} in `class-members.ts` is matched against —
 * unlike a comment's `{`/`}`, which {@link nextSignificantIndex} already
 * keeps out of brace-depth tracking, a comment's *text* would otherwise
 * still corrupt that match.
 */
export function stripComments(code: string, start: number, end: number): string {
  let result = "";
  let i = start;

  while (i < end) {
    const char = code[i];

    if (char === '"' || char === "'" || char === "`") {
      const next = nextSignificantIndex(code, i);
      result += code.slice(i, Math.min(next, end));
      i = next;
      continue;
    }

    if (char === "/" && (code[i + 1] === "/" || code[i + 1] === "*")) {
      i = nextSignificantIndex(code, i);
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
}

/** 1-based line number of `index` within `code`. */
export function lineOf(code: string, index: number): number {
  let line = 1;

  for (let i = 0; i < index; i += 1) {
    if (code[i] === "\n") {
      line += 1;
    }
  }

  return line;
}
