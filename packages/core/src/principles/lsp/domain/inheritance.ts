/**
 * Class hierarchies for the Liskov Substitution Principle rule (#12):
 * `class Name extends Parent { ... }` extraction plus the top-level
 * methods of each class, with enough body text to ask whether an override
 * introduces a new `throw`.
 *
 * Deliberately not a real parser: `@principled/core` ships no runtime
 * dependencies (ADR-0008), and the SOLID rules are heuristic by design
 * (ADR-0022). The scanner below is self-contained on purpose — sibling
 * slices each own their minimal scanner until the shapes settle enough to
 * share one (ADR-0022's accepted follow-up, not premature abstraction).
 */

/** One `class` construct found in a subject, and where it lives. */
export interface ClassInfo {
  readonly name: string;
  /** The `extends` target, if the header names one. */
  readonly parent: string | undefined;
  /** The class body, excluding the outer `{` and `}`. */
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
  /** The text from `class` up to (not including) the opening `{`, trimmed. */
  readonly headerExcerpt: string;
}

/** One top-level method of a class, excluding the constructor. */
export interface MethodInfo {
  readonly name: string;
  /** The method body, excluding the outer `{` and `}`. */
  readonly body: string;
}

const CLASS_HEADER = /\bclass\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?/g;

/**
 * Matches the header text immediately before a class member's `{`, e.g.
 * `public async fetchUser(id: string): Promise<User>`. Deliberately does
 * not match class-field arrow functions (`onClick = () => {`) — a
 * documented gap, not a silent one.
 */
const METHOD_HEADER =
  /^(?:@[\w.$]+(?:\([^)]*\))?\s*)*(?:(?:public|private|protected|static|async|abstract|override|readonly)\s+)*(?:(?:get|set)\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([\s\S]*\)\s*(?::\s*[\s\S]+)?$/;

const CONSTRUCTOR_NAME = "constructor";

/**
 * Given `code[index]` starts a string, template literal or comment,
 * returns the index just past it; otherwise returns `index + 1`.
 */
function skipNoise(code: string, index: number): number {
  const char = code[index];
  const next = code[index + 1];

  if (char === '"' || char === "'" || char === "`") {
    return skipQuoted(code, index, char as string);
  }

  if (char === "/" && next === "/") {
    const end = code.indexOf("\n", index);
    return end === -1 ? code.length : end;
  }

  if (char === "/" && next === "*") {
    const end = code.indexOf("*/", index + 2);
    return end === -1 ? code.length : end + 2;
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

/**
 * Given `code[openBraceIndex]` is `{`, returns the index of its matching
 * `}`, or `-1` if the braces never balance (malformed or truncated input).
 */
function findMatchingBrace(code: string, openBraceIndex: number): number {
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

    i = skipNoise(code, i);
  }

  return -1;
}

/** 1-based line number of `index` within `code`. */
function lineOf(code: string, index: number): number {
  let line = 1;

  for (let i = 0; i < index; i += 1) {
    if (code[i] === "\n") {
      line += 1;
    }
  }

  return line;
}

/**
 * The index of the class body's opening `{`, or `-1` if a statement
 * terminator (`;`) is reached first — an ambient declaration
 * (`declare class Foo;`) has no body to delineate.
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

    i = skipNoise(code, i);
  }

  return -1;
}

/**
 * Finds every `class Name [extends Parent] { ... }` construct in
 * `sourceCode`. A `class` keyword with no body or with unbalanced braces
 * is skipped rather than reported: this rule only makes claims about
 * constructs it can actually delineate.
 */
export function extractClasses(sourceCode: string): readonly ClassInfo[] {
  const declarations: ClassInfo[] = [];
  CLASS_HEADER.lastIndex = 0;

  let match: RegExpExecArray | null = CLASS_HEADER.exec(sourceCode);

  while (match !== null) {
    const headerStart = match.index;
    const name = match[1] as string;
    const parent = match[2] as string | undefined;
    const braceIndex = findClassBodyStart(sourceCode, CLASS_HEADER.lastIndex);
    const bodyEnd = braceIndex === -1 ? -1 : findMatchingBrace(sourceCode, braceIndex);

    if (braceIndex !== -1 && bodyEnd !== -1) {
      declarations.push({
        name,
        parent,
        body: sourceCode.slice(braceIndex + 1, bodyEnd),
        startLine: lineOf(sourceCode, headerStart),
        endLine: lineOf(sourceCode, bodyEnd),
        headerExcerpt: sourceCode.slice(headerStart, braceIndex).trim(),
      });

      CLASS_HEADER.lastIndex = bodyEnd + 1;
    }

    match = CLASS_HEADER.exec(sourceCode);
  }

  return declarations;
}

function methodNameOf(header: string): string | undefined {
  const match = METHOD_HEADER.exec(header.trim());

  if (match === null) {
    return undefined;
  }

  const name = match[1] as string;

  return name === CONSTRUCTOR_NAME ? undefined : name;
}

/**
 * The top-level methods of a class body — not the constructor, not nested
 * callbacks inside another method's body, and not class-field property
 * initializers. Scanning jumps straight past every member body already
 * found, so a `{` inside one method can never be read as the start of
 * another.
 */
export function methodBodiesOf(classBody: string): readonly MethodInfo[] {
  const methods: MethodInfo[] = [];
  let statementStart = 0;
  let i = 0;

  while (i < classBody.length) {
    const char = classBody[i];

    if (char === "{") {
      const header = classBody.slice(statementStart, i);
      const bodyEnd = findMatchingBrace(classBody, i);
      const name = methodNameOf(header);

      if (name !== undefined && bodyEnd !== -1) {
        methods.push({ name, body: classBody.slice(i + 1, bodyEnd) });
      }

      i = bodyEnd === -1 ? classBody.length : bodyEnd + 1;
      statementStart = i;
      continue;
    }

    if (char === ";") {
      i += 1;
      statementStart = i;
      continue;
    }

    i = skipNoise(classBody, i);
  }

  return methods;
}

/** `true` when `methodBody` throws outside of a string or comment. */
export function bodyThrows(methodBody: string): boolean {
  let stripped = "";
  let i = 0;

  while (i < methodBody.length) {
    const char = methodBody[i];
    const next = methodBody[i + 1];

    if (
      char === '"' ||
      char === "'" ||
      char === "`" ||
      (char === "/" && (next === "/" || next === "*"))
    ) {
      const end = skipNoise(methodBody, i);
      stripped += " ".repeat(end - i);
      i = end;
      continue;
    }

    stripped += char;
    i += 1;
  }

  return /\bthrow\b/.test(stripped);
}
