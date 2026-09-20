import {
  findMatchingBrace,
  lineOf,
  nextSignificantIndex,
} from "./source-scanner.ts";

/** One `class` construct found in a subject, and where it lives. */
export interface ClassDeclaration {
  readonly name: string;
  readonly startLine: number;
  readonly endLine: number;
  /** The text from `class` up to (not including) the opening `{`, trimmed. */
  readonly headerExcerpt: string;
  /** The class body, excluding the outer `{` and `}`. */
  readonly body: string;
}

const CLASS_KEYWORD = /\bclass\s+([A-Za-z_$][\w$]*)/g;

/**
 * One `class Name:` line in Python source: leading indentation (spaces or
 * tabs), the class name, an optional `(Base, ...)` list, and the trailing
 * colon. Matched per line, never global, so no `lastIndex` state leaks
 * between calls.
 */
const PYTHON_CLASS_LINE = /^([ \t]*)class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*:/;

/**
 * The index of the class body's opening `{`, or `-1` if a statement
 * terminator (`;`) is reached first — an ambient declaration
 * (`declare class Foo;`) has no body to delineate, and without this check
 * the search would otherwise run on into a *following* class's `{` and
 * misattribute its body to this one.
 */
function findClassBodyStart(code: string, fromIndex: number): number {
  let i = fromIndex;

  while (i < code.length) {
    if (code[i] === "{") {
      return i;
    }

    if (code[i] === ";") {
      return -1;
    }

    i = nextSignificantIndex(code, i);
  }

  return -1;
}

/**
 * Finds every `class Name ... { ... }` construct in `sourceCode`.
 *
 * A `class` keyword with no body (an ambient/truncated declaration) or with
 * unbalanced braces is skipped rather than reported: this rule only makes
 * claims about constructs it can actually delineate.
 */
export function extractClasses(sourceCode: string): readonly ClassDeclaration[] {
  const declarations: ClassDeclaration[] = [];
  CLASS_KEYWORD.lastIndex = 0;

  let match: RegExpExecArray | null = CLASS_KEYWORD.exec(sourceCode);

  while (match !== null) {
    const headerStart = match.index;
    const name = match[1] as string;
    const braceIndex = findClassBodyStart(sourceCode, CLASS_KEYWORD.lastIndex);
    const bodyEnd = braceIndex === -1 ? -1 : findMatchingBrace(sourceCode, braceIndex);

    if (braceIndex !== -1 && bodyEnd !== -1) {
      declarations.push({
        name,
        startLine: lineOf(sourceCode, headerStart),
        endLine: lineOf(sourceCode, bodyEnd),
        headerExcerpt: sourceCode.slice(headerStart, braceIndex).trim(),
        body: sourceCode.slice(braceIndex + 1, bodyEnd),
      });

      CLASS_KEYWORD.lastIndex = bodyEnd + 1;
    }

    match = CLASS_KEYWORD.exec(sourceCode);
  }

  return declarations;
}

/**
 * Finds every top-level or nested `class Name:` construct in Python
 * `sourceCode`, using indentation rather than braces: a class owns every
 * following line indented further than its own `class` line, up to (not
 * including) the first non-blank line at its own indent or less. Blank
 * lines inside the block are skipped over, never reported as boundaries.
 *
 * Comment-only lines never start a class (everything from `#` on is cut
 * before matching), and a same-line `class` keyword that is not the first
 * token (e.g. `x = "class Fake:"`) cannot match the anchored pattern. A
 * `class` line inside a multi-line string is still read as a class — the
 * same category of accepted gap as the brace path's, which is
 * string-aware for braces but equally textual everywhere else.
 * Anything fancier — a multi-line bases list, a semicolon-joined
 * `class A: pass` one-liner body — is out of scope: like the brace path,
 * this reports only constructs it can delineate, and an empty body still
 * reports (it assesses as `uncertain` for too few methods, never as a
 * false verdict).
 *
 * Nested classes are reported as their own declarations: the outer class's
 * method scan only sees its shallowest `def` lines, so nothing is
 * double-counted (see `extractMethodNames`).
 */
export function extractPythonClasses(
  sourceCode: string,
): readonly ClassDeclaration[] {
  const lines = withoutTrailingNewline(sourceCode.split("\n"));
  const declarations: ClassDeclaration[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    const match = PYTHON_CLASS_LINE.exec(line.slice(0, hashIndexOf(line)));

    if (match === null) {
      continue;
    }

    const indent = (match[1] as string).length;
    const name = match[2] as string;
    const bases = match[3] as string | undefined;
    let end = index;

    for (let body = index + 1; body < lines.length; body += 1) {
      const bodyLine = lines[body] as string;

      if (bodyLine.trim().length === 0) {
        continue;
      }

      if (leadingWhitespaceOf(bodyLine) <= indent) {
        break;
      }

      end = body;
    }

    declarations.push({
      name,
      startLine: index + 1,
      endLine: end + 1,
      headerExcerpt:
        bases === undefined ? `class ${name}` : `class ${name}(${bases.trim()})`,
      body: lines.slice(index + 1, end + 1).join("\n"),
    });
  }

  return declarations;
}

/**
 * `sourceCode.split("\n")` without the phantom final element: a trailing
 * newline terminates the last real line, it is not an extra blank line, and
 * line numbers reported as evidence must not point at it.
 */
function withoutTrailingNewline(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    return lines.slice(0, -1);
  }

  return lines;
}

/** The index of a `#` comment starter, or the line length when there is none. */
function hashIndexOf(line: string): number {
  const hash = line.indexOf("#");

  return hash === -1 ? line.length : hash;
}

/** The count of leading space/tab characters on `line`. */
function leadingWhitespaceOf(line: string): number {
  const match = /^[ \t]*/.exec(line);

  return match === null ? 0 : match[0].length;
}
