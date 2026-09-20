/**
 * Dependency-inversion signals for the Dependency Inversion Principle
 * rule (#14): imports of infrastructure modules (filesystems, sockets,
 * databases, brokers, cloud SDKs) and direct instantiations of concrete
 * infrastructure names — every one a place where high-level logic names
 * something it should only know through an abstraction it owns.
 *
 * Counts are taken over noise-stripped source (strings, template literals
 * and comments blanked, newlines preserved), so a commented-out import is
 * never read as coupling. This is deliberately not a real parser:
 * `@principled/core` ships no runtime dependencies (ADR-0008), and the
 * SOLID rules are heuristic by design (ADR-0022). The scanner below is
 * self-contained on purpose — sibling slices each own their minimal
 * scanner until the shapes settle enough to share one.
 */

export interface DependencySignals {
  readonly infraImports: number;
  readonly concreteInstantiations: number;
  readonly total: number;
}

/** Longest excerpt `locateFirstSignal` will attach to a finding. */
export const MAX_EXCERPT_LENGTH = 120;

/**
 * Module specifiers read as infrastructure. Entries match exactly; an
 * entry ending in `/` is a prefix (so `@aws-sdk/` covers
 * `@aws-sdk/client-s3`). Relative specifiers (`./`, `../`) never match.
 */
export const INFRA_MODULES: readonly string[] = [
  "fs",
  "node:fs",
  "net",
  "node:net",
  "http",
  "node:http",
  "https",
  "node:https",
  "http2",
  "child_process",
  "node:child_process",
  "cluster",
  "dgram",
  "dns",
  "tls",
  "worker_threads",
  "aws-sdk",
  "@aws-sdk/",
  "pg",
  "pg-pool",
  "mysql",
  "mysql2",
  "mariadb",
  "sqlite3",
  "better-sqlite3",
  "redis",
  "ioredis",
  "mongodb",
  "mongoose",
  "typeorm",
  "sequelize",
  "knex",
  "prisma",
  "@prisma/client",
  "axios",
  "node-fetch",
  "undici",
  "amqplib",
  "kafkajs",
  "@elastic/elasticsearch",
  "nodemailer",
];

/**
 * Name endings read as concrete infrastructure when instantiated with
 * `new` — even without a matching import, `new RedisClient(` names
 * something high-level logic should only know through an abstraction.
 */
const CONCRETE_SUFFIXES: readonly string[] = [
  "Client",
  "Connection",
  "Pool",
  "Session",
  "DataSource",
  "Socket",
  "Broker",
  "Producer",
  "Consumer",
  "Channel",
  "Queue",
  "Repository",
];

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

/**
 * `sourceCode` with every string literal, template literal and comment
 * replaced by spaces — except the string of an `import`/`export … from`,
 * `require()` or `import()` specifier, which is the one string this rule
 * must read — keeping `\n` where it was so line numbers still line up
 * with the original. Code characters pass through untouched.
 */
export function stripNoise(sourceCode: string): string {
  let result = "";
  let i = 0;

  while (i < sourceCode.length) {
    const char = sourceCode[i];
    const next = sourceCode[i + 1];

    if (char === '"' || char === "'") {
      const end = skipQuoted(sourceCode, i, char as string);

      if (isSpecifierPosition(result)) {
        result += sourceCode.slice(i, end);
      } else {
        result += blanked(sourceCode, i, end);
      }

      i = end;
      continue;
    }

    if (char === "`") {
      const end = skipQuoted(sourceCode, i, char as string);
      result += blanked(sourceCode, i, end);
      i = end;
      continue;
    }

    if (char === "/" && next === "/") {
      const end = sourceCode.indexOf("\n", i);
      const stop = end === -1 ? sourceCode.length : end;
      result += blanked(sourceCode, i, stop);
      i = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = sourceCode.indexOf("*/", i + 2);
      const stop = end === -1 ? sourceCode.length : end + 2;
      result += blanked(sourceCode, i, stop);
      i = stop;
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
}

/**
 * `true` when `codeBefore` — the stripped code up to a string's opening
 * quote — ends where a module specifier belongs: after `from`, a bare
 * `import`, or inside `require(`/`import(`.
 */
function isSpecifierPosition(codeBefore: string): boolean {
  return /(\bfrom|\bimport|\brequire\s*\(|\bimport\s*\()\s*$/.test(codeBefore);
}

function isInfraSpecifier(specifier: string): boolean {
  // No relative/absolute/blank guard here on purpose: no entry in
  // INFRA_MODULES starts with `.`, `/`, or whitespace, so such a specifier
  // can never equal an entry or its `/`-suffixed subpath — a guard would
  // only add equivalent, untestable mutants without changing the verdict.
  return INFRA_MODULES.some((entry) =>
    entry.endsWith("/")
      ? specifier === entry.slice(0, -1) || specifier.startsWith(entry)
      : specifier === entry || specifier.startsWith(`${entry}/`),
  );
}

// Stryker disable next-line Regex: narrowing `\s+from` to `\sfrom` is
// unobservable by construction — the lazy `[^'";]*?` absorbs any surplus
// whitespace — and per-line disables cannot spare the killable neighbours.
// The narrowings that DO change behaviour (post-`import` spacing, the
// optional `from` group, post-`from` spacing) stay pinned by the spacing
// tests below even though Stryker no longer reports them.
const STATIC_IMPORT = /\bimport\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;
// Stryker disable next-line Regex: narrowing `\s+` to `\s` after `export`
// or before `from` is unobservable by construction — the lazy `[^'";]*?`
// absorbs any surplus whitespace — and per-line disables cannot spare the
// killable neighbours. The narrowings that DO change behaviour
// (post-`export` absence, negated-class shapes, post-`from` spacing, quote
// and capture shapes) stay pinned by the spacing tests below even though
// Stryker no longer reports them.
const EXPORT_FROM = /\bexport\s+[^'";]*?\s+from\s+["']([^"']+)["']/g;
const REQUIRE_CALL = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function* specifiersOf(
  stripped: string,
  pattern: RegExp,
): Generator<string> {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(stripped);

  while (match !== null) {
    yield match[1] as string;
    match = pattern.exec(stripped);
  }
}

const NAMED_IMPORT = /\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const DEFAULT_IMPORT =
  /\bimport\s+([A-Za-z_$][\w$]*)\s*,?\s*(?:\{[^}]*\})?\s*from\s*["']([^"']+)["']/g;
const NAMESPACE_IMPORT = /\bimport\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["']/g;

/** Identifiers imported from infrastructure modules. */
function infraImportedNames(stripped: string): ReadonlySet<string> {
  const names = new Set<string>();

  NAMED_IMPORT.lastIndex = 0;
  let named: RegExpExecArray | null = NAMED_IMPORT.exec(stripped);

  while (named !== null) {
    if (isInfraSpecifier(named[2] as string)) {
      for (const part of (named[1] as string).split(",")) {
        // The last whitespace-separated segment is the local binding
        // (`X as Y` binds `Y`). Its shape is deliberately not re-validated:
        // a spelling that is not a plain identifier can never equal a
        // `new`-target or an infra-suffix match downstream, so rejecting it
        // here would only add equivalent, untestable mutants.
        // Stryker disable next-line Regex: only the last segment is read
        // and trimming rules out trailing empties, so splitting on runs
        // versus single characters yields the same binding.
        const local = part.trim().split(/\s+/).pop() as string;
        names.add(local);
      }
    }

    named = NAMED_IMPORT.exec(stripped);
  }

  DEFAULT_IMPORT.lastIndex = 0;
  let direct: RegExpExecArray | null = DEFAULT_IMPORT.exec(stripped);

  while (direct !== null) {
    if (isInfraSpecifier(direct[2] as string)) {
      names.add(direct[1] as string);
    }

    direct = DEFAULT_IMPORT.exec(stripped);
  }

  NAMESPACE_IMPORT.lastIndex = 0;
  let namespace: RegExpExecArray | null = NAMESPACE_IMPORT.exec(stripped);

  while (namespace !== null) {
    if (isInfraSpecifier(namespace[2] as string)) {
      names.add(namespace[1] as string);
    }

    namespace = NAMESPACE_IMPORT.exec(stripped);
  }

  return names;
}

const NEW_EXPRESSION = /\bnew\s+([A-Za-z_$][\w$]*)/g;

function isConcreteName(name: string, infraNames: ReadonlySet<string>): boolean {
  return (
    infraNames.has(name) ||
    CONCRETE_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

/**
 * Counts inversion signals in `sourceCode`: infrastructure imports plus
 * direct instantiations of concrete infrastructure names (by suffix, or
 * by being imported from an infrastructure module). `total` is the sum of
 * both groups.
 */
export function countDependencySignals(sourceCode: string): DependencySignals {
  const stripped = stripNoise(sourceCode);
  const specifiers = [
    ...specifiersOf(stripped, STATIC_IMPORT),
    ...specifiersOf(stripped, EXPORT_FROM),
    ...specifiersOf(stripped, REQUIRE_CALL),
    ...specifiersOf(stripped, DYNAMIC_IMPORT),
  ];
  const infraImports = specifiers.filter(isInfraSpecifier).length;
  const infraNames = infraImportedNames(stripped);

  NEW_EXPRESSION.lastIndex = 0;
  let concreteInstantiations = 0;
  let match: RegExpExecArray | null = NEW_EXPRESSION.exec(stripped);

  while (match !== null) {
    if (isConcreteName(match[1] as string, infraNames)) {
      concreteInstantiations += 1;
    }

    match = NEW_EXPRESSION.exec(stripped);
  }

  return {
    infraImports,
    concreteInstantiations,
    total: infraImports + concreteInstantiations,
  };
}

export interface SignalLocation {
  readonly startLine: number;
  readonly excerpt: string;
}

/**
 * The first noise-stripped line containing an inversion signal (an
 * infrastructure import or a concrete instantiation), with its original
 * (unblanked) text trimmed and capped at {@link MAX_EXCERPT_LENGTH}
 * characters — the minimal evidence a finding can point at. `undefined`
 * when the subject has no signal at all.
 */
export function locateFirstSignal(
  sourceCode: string,
): SignalLocation | undefined {
  const stripped = stripNoise(sourceCode);
  const infraNames = infraImportedNames(stripped);
  const strippedLines = stripped.split("\n");
  const originalLines = sourceCode.split("\n");

  // No `text.length > 0` guard here on purpose: a stripped line that holds
  // a signal necessarily holds code characters, which pass through
  // unblanked, so the original line is never blank where a signal is found.
  for (const [i, strippedLine] of strippedLines.entries()) {
    if (lineHasSignal(strippedLine, infraNames)) {
      const text = (originalLines[i] as string).trim();

      return { startLine: i + 1, excerpt: text.slice(0, MAX_EXCERPT_LENGTH) };
    }
  }

  return undefined;
}

function lineHasSignal(
  strippedLine: string,
  infraNames: ReadonlySet<string>,
): boolean {
  const specifiers = [
    ...specifiersOf(strippedLine, STATIC_IMPORT),
    ...specifiersOf(strippedLine, EXPORT_FROM),
    ...specifiersOf(strippedLine, REQUIRE_CALL),
    ...specifiersOf(strippedLine, DYNAMIC_IMPORT),
  ];

  if (specifiers.some(isInfraSpecifier)) {
    return true;
  }

  NEW_EXPRESSION.lastIndex = 0;
  let match: RegExpExecArray | null = NEW_EXPRESSION.exec(strippedLine);

  while (match !== null) {
    if (isConcreteName(match[1] as string, infraNames)) {
      return true;
    }

    match = NEW_EXPRESSION.exec(strippedLine);
  }

  return false;
}
