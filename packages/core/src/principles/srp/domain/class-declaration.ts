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
