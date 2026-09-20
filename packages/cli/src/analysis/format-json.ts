import type { AnalysisRun } from "@principled/core";
import { VERSION } from "../version.ts";
import { ANALYSIS_OUTPUT_SCHEMA_VERSION } from "./schema-version.ts";
import { toPlainResult, type PlainResult } from "./serialize-result.ts";

export interface JsonOutputOptions {
  /** File path label for the subject, when the input came from a file. */
  readonly filePath?: string | undefined;
  /** Include a `durationMs` field. Off by default so output stays deterministic. */
  readonly durationMs?: number | undefined;
}

export interface JsonAnalysisOutput {
  readonly schemaVersion: string;
  readonly tool: { readonly name: string; readonly version: string };
  readonly status: "completed";
  readonly subject: { readonly language: string; readonly filePath?: string | undefined };
  readonly ruleCount: number;
  readonly resultCounts: Readonly<Record<string, number>>;
  readonly results: readonly PlainResult[];
  readonly durationMs?: number | undefined;
}

/**
 * Versioned JSON envelope for `--format json` (#19, #44).
 *
 * Deterministic by default: no timestamps, no durations, no user or host
 * identifiers — only the schema version, the tool version, the analysis
 * status, rule/result counts, and the results themselves.
 */
export function toJsonOutput(
  run: AnalysisRun,
  language: string,
  options: JsonOutputOptions = {},
): JsonAnalysisOutput {
  const results = run.results.map(toPlainResult);
  const resultCounts: Record<string, number> = {};

  for (const result of results) {
    resultCounts[result.status] = (resultCounts[result.status] ?? 0) + 1;
  }

  return {
    schemaVersion: ANALYSIS_OUTPUT_SCHEMA_VERSION,
    tool: { name: "principled", version: VERSION },
    status: "completed",
    subject: {
      language,
      ...(options.filePath === undefined ? {} : { filePath: options.filePath }),
    },
    ruleCount: results.length,
    resultCounts,
    results,
    ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
  };
}
