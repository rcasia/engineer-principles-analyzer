/**
 * Heuristic programming-language detection for the analysis engine.
 *
 * The analyzer used to require callers to name the language up front, which
 * made pasted snippets and uploaded files without a `language` field fail
 * validation even when the language was obvious from the filename or the
 * code itself. These helpers infer it instead: an explicit language still
 * wins wherever one is given, but when it is missing the adapters can fall
 * back to {@link detectLanguage} rather than rejecting the submission.
 *
 * Deliberately dependency-free and purely textual (ADR-0008, ADR-0022):
 * extension lookup first — a filename is a statement of intent — then a
 * small set of distinctive content signals per language. A single signal is
 * enough, because each one was chosen to be rare outside its own language
 * (`System.out.println`, `println!`, `if __name__`, ...). Anything ambiguous
 * (a bare `class Foo {}` with no further signals) returns `undefined`
 * instead of guessing, so the caller can ask the user rather than
 * misattribute the analysis.
 */

const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  pyw: "python",
  go: "go",
  rs: "rust",
  java: "java",
};

/**
 * The language implied by a filename's extension, or `undefined` when the
 * name carries no recognised extension. Matching is case-insensitive and
 * only the text after the final `.` counts, so `archive.tar.gz` looks up
 * `gz` (unknown) and dotfiles such as `.gitignore` — or even `.py`, whose
 * leading dot starts a hidden name rather than an extension — have no
 * extension at all. A trailing dot leaves an empty extension, which no
 * language claims. Only the file name matters: any directory prefix is
 * ignored.
 */
export function languageForFilename(filename: string): string | undefined {
  const base = filename.split("/").pop()?.split("\\").pop() ?? "";
  const dot = base.lastIndexOf(".");

  if (dot <= 0) {
    return undefined;
  }

  return EXTENSION_TO_LANGUAGE[base.slice(dot + 1).toLowerCase()];
}

function hasJavaSignals(code: string): boolean {
  return (
    /\bpublic\s+class\s+\w+/.test(code) ||
    /System\.out\.println/.test(code) ||
    /\bimport\s+java\./.test(code)
  );
}

function hasGoSignals(code: string): boolean {
  return (
    /^package\s+\w+/m.test(code) ||
    /\bfunc\s+\w+\s*\(/.test(code) ||
    /\bfmt\.Print/.test(code)
  );
}

function hasRustSignals(code: string): boolean {
  return (
    /\bprintln!\s*\(/.test(code) ||
    /\blet\s+mut\s+\w+/.test(code) ||
    /\bfn\s+\w+\s*\(/.test(code)
  );
}

function hasPythonSignals(code: string): boolean {
  return (
    /^\s*def\s+\w+\s*\(/m.test(code) ||
    /\bprint\s*\(/.test(code) ||
    /if\s+__name__\s*==/.test(code) ||
    /^\s*elif\b/m.test(code)
  );
}

function hasTypeScriptSignals(code: string): boolean {
  return (
    /\binterface\s+\w+/.test(code) ||
    /\btype\s+\w+\s*=/.test(code) ||
    /:\s*(string|number|boolean|void)\b/.test(code) ||
    /\breadonly\b/.test(code) ||
    /\bexport\s+(interface|type)\b/.test(code)
  );
}

function hasJavaScriptSignals(code: string): boolean {
  return (
    /console\.log\s*\(/.test(code) ||
    /\brequire\s*\(/.test(code) ||
    /\bmodule\.exports\b/.test(code) ||
    /\bfunction\s+\w+\s*\(/.test(code)
  );
}

/**
 * The language the source text itself points at, or `undefined` when no
 * distinctive signal matches. Checks run most-distinctive first (Java's
 * `public class` before anything that also contains the word `class`), so
 * a file matching two languages resolves deterministically rather than by
 * whichever check happened to run last.
 */
export function languageForSource(sourceCode: string): string | undefined {
  if (hasJavaSignals(sourceCode)) {
    return "java";
  }

  if (hasGoSignals(sourceCode)) {
    return "go";
  }

  if (hasRustSignals(sourceCode)) {
    return "rust";
  }

  if (hasPythonSignals(sourceCode)) {
    return "python";
  }

  if (hasTypeScriptSignals(sourceCode)) {
    return "typescript";
  }

  if (hasJavaScriptSignals(sourceCode)) {
    return "javascript";
  }

  return undefined;
}

/**
 * Detects the programming language of one subject: the filename extension
 * when it names a known language, otherwise the content signals, otherwise
 * `undefined` (unknown — the caller should ask for a language explicitly
 * rather than guess). A missing filename simply skips the extension step;
 * a blank or unknown one falls through to the content the same way, since
 * neither can name an extension.
 */
export function detectLanguage(
  sourceCode: string,
  filenameHint?: string,
): string | undefined {
  const fromFilename =
    filenameHint === undefined
      ? undefined
      : languageForFilename(filenameHint);

  if (fromFilename !== undefined) {
    return fromFilename;
  }

  return languageForSource(sourceCode);
}
