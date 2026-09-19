import {
  findMatchingBrace,
  nextSignificantIndex,
  stripComments,
} from "./source-scanner.ts";

const CONSTRUCTOR_NAME = "constructor";

/**
 * Matches the header text immediately before a class member's `{`, e.g.
 * `public async fetchUser<T>(id: string): Promise<T>`. Deliberately does
 * not match class-field arrow functions (`onClick = () => {`) — a documented
 * gap (ADR-0022), not a silent one.
 */
const METHOD_HEADER =
  /^(?:@[\w.$]+(?:\([^)]*\))?\s*)*(?:(?:public|private|protected|static|async|abstract|override|readonly)\s+)*(?:(?:get|set)\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([\s\S]*\)\s*(?::\s*[\s\S]+)?$/;

function methodNameOf(header: string): string | undefined {
  const match = METHOD_HEADER.exec(header.trim());

  return match === null ? undefined : (match[1] as string);
}

/**
 * The names of every top-level method in a class body — not the
 * constructor, not nested callbacks inside another method's body, not
 * class-field property initializers, and not a control-flow statement
 * (`if`, `for`, `while`, ...): every one of those is either not shaped like
 * `identifier(...) {` at all, or — for a control-flow statement inside a
 * method — is never inspected as a header candidate in the first place,
 * because scanning jumps straight past the *enclosing* method's entire
 * body (below) before reaching it.
 *
 * Scans `classBody` once, skipping over strings/templates/comments (via
 * {@link nextSignificantIndex}) and over the body of every member already
 * found (via {@link findMatchingBrace}), so a `{` inside one method can
 * never be read as the start of another.
 */
export function extractMethodNames(classBody: string): readonly string[] {
  const names: string[] = [];
  let statementStart = 0;
  let i = 0;

  while (i < classBody.length) {
    const char = classBody[i];

    if (char === "{") {
      const header = stripComments(classBody, statementStart, i);
      const bodyEnd = findMatchingBrace(classBody, i);
      const name = methodNameOf(header);

      if (name !== undefined && name !== CONSTRUCTOR_NAME) {
        names.push(name);
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

    i = nextSignificantIndex(classBody, i);
  }

  return names;
}
