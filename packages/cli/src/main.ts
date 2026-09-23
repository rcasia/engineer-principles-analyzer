import { InMemoryPrincipleCatalog, ListPrinciples } from "@principled/core";
import { readFile } from "node:fs/promises";
import { toJsonOutput } from "./analysis/format-json.ts";
import { toSarifOutput } from "./analysis/format-sarif.ts";
import { parseAnalyzeArgs } from "./analysis/parse-analyze-args.ts";
import { runAnalysis } from "./analysis/run-analysis.ts";
import { renderFindings } from "./presentation/render-analysis.ts";
import { renderPrinciples } from "./presentation/render-principles.ts";
import {
  renderAnalyzeUsage,
  renderUnknownOption,
  renderUsage,
  renderVersion,
} from "./presentation/usage.ts";

export type Writer = (line: string) => void;

export interface Console {
  readonly out: Writer;
  readonly err: Writer;
}

/** Reads one input file as UTF-8 text. Injected so tests never touch disk. */
export type FileReader = (path: string) => Promise<string>;
/** Reads piped source from stdin. Injected so tests never block on fd 0. */
export type StdinReader = () => Promise<string>;

export interface MainDependencies {
  readonly readFile?: FileReader | undefined;
  readonly readStdin?: StdinReader | undefined;
  /** True when stdin is a terminal: `analyze` with no file would hang waiting. */
  readonly stdinIsTTY?: boolean | undefined;
}

export const EXIT_OK = 0;
/**
 * The analysis completed and at least one result is a `violation`.
 * CI workflows fail on this code to block the change; `0` and `1` both
 * mean the analysis itself succeeded.
 */
export const EXIT_FINDINGS = 1;
/**
 * No analysis happened: bad flags, missing input, an unreadable file, or
 * an empty source.
 */
export const EXIT_USAGE = 2;

const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h"]);
const VERSION_FLAGS: ReadonlySet<string> = new Set(["--version", "-v"]);

/** Default file reader used when the caller injects none. Exported for tests. */
export async function defaultReadFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/**
 * Default stdin reader used when the caller injects none. The stream is a
 * parameter (defaulting to fd 0) so tests can feed bytes without blocking
 * on a real terminal. Exported for tests.
 */
export async function defaultReadStdin(
  stream: AsyncIterable<Uint8Array> = process.stdin,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  // Buffer.toString defaults to UTF-8; spelling the literal out would leave
  // an unkillable mutant (Bun decodes "" leniently), so rely on the default.
  return Buffer.concat(chunks).toString();
}

/**
 * Composition root. The hexagon is assembled here and nowhere else, and both
 * output streams plus file access are injected, so the whole command is
 * testable in process and the exit code is a return value rather than a
 * side effect.
 *
 * Privacy: analysis is local only. Nothing is sent anywhere; errors never
 * include the submitted source (#43).
 */
export async function main(
  argv: readonly string[],
  console: Console,
  deps: MainDependencies = {},
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === "analyze") {
    return runAnalyzeCommand(rest, console, deps);
  }

  if (command !== undefined) {
    if (HELP_FLAGS.has(command)) {
      console.out(renderUsage());
      return EXIT_OK;
    }

    if (VERSION_FLAGS.has(command)) {
      console.out(renderVersion());
      return EXIT_OK;
    }

    console.err(renderUnknownOption(command));
    return EXIT_USAGE;
  }

  const listPrinciples = new ListPrinciples(new InMemoryPrincipleCatalog());
  console.out(renderPrinciples(await listPrinciples.execute()));

  return EXIT_OK;
}

async function runAnalyzeCommand(
  args: readonly string[],
  console: Console,
  deps: MainDependencies,
): Promise<number> {
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    console.out(renderAnalyzeUsage());
    return EXIT_OK;
  }

  const parsed = parseAnalyzeArgs(args);

  if (!parsed.ok) {
    console.err(parsed.message);
    return EXIT_USAGE;
  }

  const { filePath, fromStdin, format, language: requestedLanguage, ruleIds, timing } = parsed.options;
  const readFileFn = deps.readFile ?? defaultReadFile;
  const readStdinFn = deps.readStdin ?? defaultReadStdin;
  const stdinIsTTY = deps.stdinIsTTY ?? process.stdin.isTTY ?? false;

  if (filePath !== undefined && fromStdin) {
    console.err("Cannot use both a file and --stdin. Provide one input.");
    return EXIT_USAGE;
  }

  let sourceCode: string;
  let filename: string | undefined;

  if (filePath !== undefined) {
    try {
      sourceCode = await readFileFn(filePath);
    } catch {
      // Name the path, never the source: the file could not even be read.
      console.err(`Could not read file: ${filePath}`);
      return EXIT_USAGE;
    }
    filename = filePath;
  } else {
    if (stdinIsTTY && !fromStdin) {
      console.err("No input given. Provide a file path or pipe source via stdin.");
      return EXIT_USAGE;
    }
    sourceCode = await readStdinFn();
    filename = undefined;
  }

  const startedAt = Date.now();
  const outcome = await runAnalysis({
    sourceCode,
    language: requestedLanguage,
    filename,
    ruleIds,
  });

  if (!outcome.ok) {
    console.err(outcome.failure.message);
    return EXIT_USAGE;
  }

  const { run, language } = outcome;
  const label = filePath ?? "stdin";

  if (format === "json") {
    console.out(
      JSON.stringify(
        toJsonOutput(run, language, {
          filePath: label,
          ...(timing ? { durationMs: Date.now() - startedAt } : {}),
        }),
      ),
    );
  } else if (format === "sarif") {
    const sarif = toSarifOutput(run, { filePath: label });
    if (timing) {
      const durationMs = Date.now() - startedAt;
      console.out(
        JSON.stringify({
          ...sarif,
          runs: sarif.runs.map((entry) => ({
            ...entry,
            properties: { ...entry.properties, "principled/durationMs": durationMs },
          })),
        }),
      );
    } else {
      console.out(JSON.stringify(sarif));
    }
  } else {
    console.out(renderFindings(run.results));
    if (timing) {
      console.err(`analyzed in ${Date.now() - startedAt}ms`);
    }
  }

  return run.results.some((result) => result.status === "violation")
    ? EXIT_FINDINGS
    : EXIT_OK;
}
