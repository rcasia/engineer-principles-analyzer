import { InMemoryPrincipleCatalog, ListPrinciples } from "@principled/core";
import { readFile } from "node:fs/promises";
import { toJsonOutput } from "./analysis/format-json.ts";
import { toSarifOutput } from "./analysis/format-sarif.ts";
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
 * a subject the engine cannot evaluate (empty source, unknown language).
 */
export const EXIT_USAGE = 2;

const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h"]);
const VERSION_FLAGS: ReadonlySet<string> = new Set(["--version", "-v"]);
const FORMATS: ReadonlySet<string> = new Set(["human", "json", "sarif"]);

async function defaultReadFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function defaultReadStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks).toString("utf8");
}

interface AnalyzeOptions {
  filePath: string | undefined;
  fromStdin: boolean;
  format: string;
  language: string | undefined;
  ruleIds: string[] | undefined;
  timing: boolean;
}

function parseAnalyzeArgs(args: readonly string[]):
  | { readonly ok: true; readonly options: AnalyzeOptions }
  | { readonly ok: false; readonly message: string } {
  const options: AnalyzeOptions = { filePath: undefined, fromStdin: false, format: "human", language: undefined, ruleIds: undefined, timing: false };

  let index = 0;
  while (index < args.length) {
    const arg = args[index] as string;

    if (arg === "--stdin") {
      options.fromStdin = true;
      index += 1;
      continue;
    }

    if (arg === "--timing") {
      options.timing = true;
      index += 1;
      continue;
    }

    if (arg === "--format" || arg.startsWith("--format=")) {
      const value =
        arg === "--format" ? args[index + 1] : arg.slice("--format=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --format. Expected human, json, or sarif." };
      }
      if (!FORMATS.has(value)) {
        return { ok: false, message: `Unknown format: ${value}. Expected human, json, or sarif.` };
      }
      options.format = value;
      index += arg === "--format" ? 2 : 1;
      continue;
    }

    if (arg === "--language" || arg.startsWith("--language=")) {
      const value =
        arg === "--language" ? args[index + 1] : arg.slice("--language=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --language. Expected one of typescript, javascript, python, go, rust, java." };
      }
      options.language = value;
      index += arg === "--language" ? 2 : 1;
      continue;
    }

    if (arg === "--rule" || arg.startsWith("--rule=")) {      const value =
        arg === "--rule" ? args[index + 1] : arg.slice("--rule=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --rule. Expected a rule id such as solid.srp." };
      }
      const ids = value.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
      if (ids.length === 0) {
        return { ok: false, message: "Missing value for --rule. Expected a rule id such as solid.srp." };
      }
      options.ruleIds = [...(options.ruleIds ?? []), ...ids];
      index += arg === "--rule" ? 2 : 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown option: ${arg}\nRun 'principled analyze --help' to see the available options.` };
    }

    if (options.filePath !== undefined) {
      return { ok: false, message: `Unexpected argument: ${arg}\nRun 'principled analyze --help' to see the available options.` };
    }

    if (arg === "-") {
      options.fromStdin = true;
    } else {
      options.filePath = arg;
    }
    index += 1;
  }

  return { ok: true, options };
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

  const startedAt = timing ? Date.now() : undefined;
  const outcome = await runAnalysis({
    sourceCode,
    ...(requestedLanguage === undefined ? {} : { language: requestedLanguage }),
    ...(filename === undefined ? {} : { filename }),
    ...(ruleIds === undefined ? {} : { ruleIds }),
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
          ...(startedAt === undefined ? {} : { durationMs: Date.now() - startedAt }),
        }),
      ),
    );
  } else if (format === "sarif") {
    const sarif = toSarifOutput(run, { filePath: label });
    if (timing && startedAt !== undefined) {
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
    if (timing && startedAt !== undefined) {
      console.err(`analyzed in ${Date.now() - startedAt}ms`);
    }
  }

  return run.results.some((result) => result.status === "violation")
    ? EXIT_FINDINGS
    : EXIT_OK;
}
