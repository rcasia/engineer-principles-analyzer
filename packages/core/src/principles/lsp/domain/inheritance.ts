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
  // Stryker disable next-line Regex: four quantifier narrowings on this
  // pattern are unobservable by construction, and per-line disables cannot
  // spare their killable neighbours —
  // - `(?:public|…|readonly)\s+` to `\s`: the following
  //   `(?:(?:get|set)\s+)?\*?\s*` absorbs the slack;
  // - `(?:get|set)\s+` to `\s`: the following `\*?\s*` absorbs the slack;
  // - `:\s*` to `:\S*`: both spellings accept exactly `:` plus at least one
  //   character, so they recognise the same return types;
  // - `[\s\S]+` to `[\S\S]+`: the header is trimmed before matching, so an
  //   all-whitespace return type never reaches the pattern and any other
  //   return type starts with a non-space the narrowed class still accepts.
  // The narrowings that DO change behaviour (anchors, decorator and
  // modifier shapes, generic arity, parameter and return-type presence, …)
  // stay pinned by the dedicated tests below even though Stryker no longer
  // reports them.
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
    // Stryker disable next-line ConditionalExpression, UnaryOperator: when
    // no newline follows, returning -1 instead of the length is unobservable
    // — every caller stores it in its scan index, and both -1 and the length
    // read as undefined and end the scan the same way. (A `\n` can never sit
    // at index 1 here either: the branch needs `//` at 0 and 1.)
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

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (code[i] !== undefined) {
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

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (code[i] !== undefined) {
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

  // Iterate the prefix itself rather than an index bound: every character is
  // inspected exactly once, so no weaken-able boundary remains.
  for (const char of code.slice(0, index)) {
    if (char === "\n") {
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

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (code[i] !== undefined) {
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

    if (braceIndex === -1) {
      match = CLASS_HEADER.exec(sourceCode);
      continue;
    }

    const bodyEnd = findMatchingBrace(sourceCode, braceIndex);

    if (bodyEnd === -1) {
      match = CLASS_HEADER.exec(sourceCode);
      continue;
    }

    declarations.push({
      name,
      parent,
      body: sourceCode.slice(braceIndex + 1, bodyEnd),
      startLine: lineOf(sourceCode, headerStart),
      endLine: lineOf(sourceCode, bodyEnd),
      headerExcerpt: sourceCode.slice(headerStart, braceIndex).trim(),
    });

    // Stryker disable next-line ArithmeticOperator: resuming one character
    // earlier cannot match anything new — no `class` keyword can start on
    // the consumed body's closing brace — so the search finds the same
    // next match either way.
    CLASS_HEADER.lastIndex = bodyEnd + 1;

    match = CLASS_HEADER.exec(sourceCode);
  }

  return declarations;
}

function methodNameOf(header: string): string | undefined {
  // No `.trim()` here on purpose: the pattern's leading `\s*` already
  // absorbs surrounding whitespace, so trimming would only add an
  // equivalent, untestable mutant without changing the match.
  const match = METHOD_HEADER.exec(header);

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

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (classBody[i] !== undefined) {
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
  // Stryker disable next-line StringLiteral: the seed carries no `throw`
  // word and only a whole-word `throw` is ever read back, so seeding noise
  // cannot flip the verdict.
  let stripped = "";
  let i = 0;

  // Scan while characters remain: the bound is load-bearing, so weakening
  // it observably breaks scanning instead of surviving undiscovered.
  while (methodBody[i] !== undefined) {
    const char = methodBody[i];
    const next = methodBody[i + 1];

    if (
      char === '"' ||
      char === "'" ||
      char === "`" ||
      // A `/` only starts noise as `//` or `/*` (`next` stringifies to
      // "undefined" at the very end, which matches neither): comparing the
      // pair keeps a lone slash (division) on the code path, where no mutant
      // can hide behind swapping the slash for the blank it would add.
      `${char}${next}` === "//" ||
      `${char}${next}` === "/*"
    ) {
      const end = skipNoise(methodBody, i);
      // Stryker disable next-line ArithmeticOperator: widening the blank
      // only adds spaces, which can neither create nor destroy a
      // whole-word `throw` match.
      stripped += " ".repeat(end - i);
      i = end;
      continue;
    }

    stripped += char;
    i += 1;
  }

  return /\bthrow\b/.test(stripped);
}
