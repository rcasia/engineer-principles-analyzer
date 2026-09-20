/**
 * Interface-shaped constructs for the Interface Segregation Principle rule
 * (#13): TypeScript `interface Name { ... }` declarations and `type Name =
 * { ... }` object literals, with a textual count of their top-level
 * members.
 *
 * Member counting is deliberately textual, not semantic: a fragment split
 * on `;` or a newline at brace depth zero counts as one member, so a
 * signature broken across lines without semicolons over-counts and a
 * nested object literal counts once. That gap is disclosed on every
 * verdict rather than hidden.
 *
 * The scanner below is self-contained on purpose — sibling slices each
 * own their minimal scanner until the shapes settle enough to share one
 * (ADR-0022's accepted follow-up, not premature abstraction).
 */

/** One `interface` or object-`type` construct found in a subject. */
export interface InterfaceInfo {
  readonly name: string;
  readonly kind: "interface" | "type";
  readonly memberCount: number;
  readonly startLine: number;
  readonly endLine: number;
  /** The text from `interface`/`type` up to (not including) the opening `{`, trimmed. */
  readonly headerExcerpt: string;
}

const INTERFACE_HEADER = /\binterface\s+([A-Za-z_$][\w$]*)/g;
const TYPE_LITERAL_HEADER = /\btype\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;

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
 * The index of the body's opening `{`, or `-1` if a statement terminator
 * (`;`) is reached first — a non-object `type X = string;` never matches
 * the header pattern, but an `interface` forward reference could.
 */
function findBodyStart(code: string, fromIndex: number): number {
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
 * Counts top-level members of an interface body: fragments split on `;`
 * or a newline at brace depth zero, with strings and comments skipped so
 * a `;` inside either never splits. A nested object literal stays one
 * fragment; a signature broken across lines without semicolons counts
 * once per line.
 */
export function countMembers(interfaceBody: string): number {
  let count = 0;
  let fragment = "";
  let depth = 0;
  let i = 0;

  const flush = (): void => {
    if (fragment.trim().length > 0) {
      count += 1;
    }

    fragment = "";
  };

  while (i < interfaceBody.length) {
    const char = interfaceBody[i];

    if (char === "{" || char === "}") {
      fragment += char;
      depth += char === "{" ? 1 : -1;
      i += 1;
      continue;
    }

    if ((char === ";" || char === "\n") && depth === 0) {
      flush();
      i += 1;
      continue;
    }

    const next = skipNoise(interfaceBody, i);

    if (next === i + 1) {
      fragment += char;
    }

    i = next;
  }

  flush();

  return count;
}

interface RawDeclaration {
  readonly kind: "interface" | "type";
  readonly name: string;
  readonly headerStart: number;
  readonly braceIndex: number;
}

function collectRaw(sourceCode: string): readonly RawDeclaration[] {
  const found: RawDeclaration[] = [];

  INTERFACE_HEADER.lastIndex = 0;
  let match: RegExpExecArray | null = INTERFACE_HEADER.exec(sourceCode);

  while (match !== null) {
    const braceIndex = findBodyStart(sourceCode, INTERFACE_HEADER.lastIndex);

    if (braceIndex !== -1) {
      found.push({
        kind: "interface",
        name: match[1] as string,
        headerStart: match.index,
        braceIndex,
      });
    }

    match = INTERFACE_HEADER.exec(sourceCode);
  }

  TYPE_LITERAL_HEADER.lastIndex = 0;
  match = TYPE_LITERAL_HEADER.exec(sourceCode);

  while (match !== null) {
    found.push({
      kind: "type",
      name: match[1] as string,
      headerStart: match.index,
      braceIndex: match.index + match[0].length - 1,
    });

    match = TYPE_LITERAL_HEADER.exec(sourceCode);
  }

  return found.sort((a, b) => a.headerStart - b.headerStart);
}

/**
 * Finds every `interface Name { ... }` and `type Name = { ... }`
 * construct in `sourceCode`. A construct with no body or with unbalanced
 * braces is skipped rather than reported: this rule only makes claims
 * about constructs it can actually delineate.
 */
export function extractInterfaces(sourceCode: string): readonly InterfaceInfo[] {
  const infos: InterfaceInfo[] = [];

  for (const raw of collectRaw(sourceCode)) {
    const bodyEnd = findMatchingBrace(sourceCode, raw.braceIndex);

    if (bodyEnd === -1) {
      continue;
    }

    const body = sourceCode.slice(raw.braceIndex + 1, bodyEnd);

    infos.push({
      name: raw.name,
      kind: raw.kind,
      memberCount: countMembers(body),
      startLine: lineOf(sourceCode, raw.headerStart),
      endLine: lineOf(sourceCode, bodyEnd),
      headerExcerpt: sourceCode.slice(raw.headerStart, raw.braceIndex).trim(),
    });
  }

  return infos;
}
