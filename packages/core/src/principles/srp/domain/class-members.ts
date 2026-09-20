import {
  findMatchingBrace,
  nextSignificantIndex,
  stripComments,
} from "./source-scanner.ts";

const CONSTRUCTOR_NAME = "constructor";

/**
 * The Python constructor: excluded like `constructor` below, since a
 * class's own allocator is not evidence about its responsibilities.
 */
const PYTHON_INIT_NAME = "__init__";

/**
 * Matches the header text immediately before a class member's `{`, e.g.
 * `public async fetchUser<T>(id: string): Promise<T>` or Java's
 * `public static String render() throws IOException`. Deliberately does
 * not match class-field arrow functions (`onClick = () => {`) — a documented
 * gap (ADR-0022), not a silent one.
 *
 * Beyond the TypeScript shapes this also tolerates a single leading return
 * type (`void save(...)`, `String render(...)`), a leading generic list
 * (`<T> void foo(T value)`) and a trailing `throws` clause, so Java method
 * headers match without changing what already matched: the return-type
 * group requires a trailing space, so `foo()` still parses as a bare name,
 * and the `throws` group requires the keyword, so `foo() unexpected` still
 * fails outright.
 */
const METHOD_HEADER =
  /^(?:@[\w.$]+(?:\([^)]*\))?\s*)*(?:(?:public|private|protected|static|async|abstract|override|readonly)\s+)*(?:(?:get|set)\s+)?\*?\s*(?:<[^>]*>\s*)?(?:[A-Za-z_$][\w$]*(?:<[^>]*>|\[\])?\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([\s\S]*\)\s*(?::\s*[\s\S]+)?(?:\s+throws\s+[A-Za-z_$][\w$.,\s]*)?$/;

/** One `def name(` (or `async def name(`) line and its indentation depth. */
const PYTHON_DEF_LINE = /^([ \t]*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/;

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
 *
 * `language` selects the interpretation (ADR-0031): `"python"` reads
 * `def` lines at the shallowest definition depth instead of brace headers,
 * every other language uses the brace scan. `className` excludes a
 * constructor spelled as the class itself (Java's `public Foo(...)`)
 * alongside the `constructor`/`__init__` spellings; it defaults to `""`,
 * which no real method is named, so callers that do not know the class
 * keep the previous behaviour exactly.
 */
export function extractMethodNames(
  classBody: string,
  language = "",
  className = "",
): readonly string[] {
  if (language.trim().toLowerCase() === "python") {
    return extractPythonDefNames(classBody, className);
  }

  const names: string[] = [];
  let statementStart = 0;
  let i = 0;

  while (i < classBody.length) {
    const char = classBody[i];

    if (char === "{") {
      const header = stripComments(classBody, statementStart, i);
      const bodyEnd = findMatchingBrace(classBody, i);
      const name = methodNameOf(header);

      if (
        name !== undefined &&
        name !== CONSTRUCTOR_NAME &&
        name !== PYTHON_INIT_NAME &&
        name !== className
      ) {
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

/**
 * The names of a Python class body's own methods: every `def` at the
 * shallowest definition depth inside the body. Deeper `def`s are nested
 * functions (or a nested class's methods), not this class's interface, and
 * `__init__` is the constructor, not a responsibility signal.
 */
function extractPythonDefNames(
  classBody: string,
  className: string,
): readonly string[] {
  const found: { readonly indent: number; readonly name: string }[] = [];

  for (const line of classBody.split("\n")) {
    const match = PYTHON_DEF_LINE.exec(line);

    if (match !== null) {
      found.push({
        indent: (match[1] as string).length,
        name: match[2] as string,
      });
    }
  }

  if (found.length === 0) {
    return [];
  }

  const topLevel = found.reduce(
    (minimum, entry) => (entry.indent < minimum ? entry.indent : minimum),
    Number.POSITIVE_INFINITY,
  );

  return found
    .filter((entry) => entry.indent === topLevel)
    .map((entry) => entry.name)
    .filter(
      (name) =>
        name !== CONSTRUCTOR_NAME &&
        name !== PYTHON_INIT_NAME &&
        name !== className,
    );
}
