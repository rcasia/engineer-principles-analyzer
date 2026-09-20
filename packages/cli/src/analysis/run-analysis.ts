import {
  AnalyzeSubject,
  InMemoryRuleCatalog,
  SrpRule,
  Subject,
} from "@principled/core";
import type { AnalysisRun } from "@principled/core";
import { LANGUAGE_GUIDANCE, resolveLanguage } from "./offline-language.ts";

export { LANGUAGE_GUIDANCE };

export interface AnalysisInput {
  /** The code under analysis. Never echoed back in errors (#43). */
  readonly sourceCode: string;
  /** Explicit language for the subject, e.g. from `--language`. */
  readonly language?: string | undefined;
  /** Hint for extension-based resolution, usually the file path. */
  readonly filename?: string | undefined;
  /** Restrict the run to these rule ids. Omitted: every registered rule runs. */
  readonly ruleIds?: readonly string[] | undefined;
}

export type AnalysisFailure =
  | { readonly kind: "empty-source"; readonly message: string }
  | { readonly kind: "unknown-language"; readonly message: string };

export type AnalysisOutcome =
  | { readonly ok: true; readonly run: AnalysisRun; readonly language: string }
  | { readonly ok: false; readonly failure: AnalysisFailure };

/** The rules the CLI runs: exactly the set the web adapter serves (#20). */
export function createRuleCatalog(): InMemoryRuleCatalog {
  return new InMemoryRuleCatalog([new SrpRule()]);
}

/**
 * Runs the shared engine over one subject, resolving the language offline:
 * an explicit language first, then the filename extension (see
 * `offline-language.ts` for why content is never guessed here). No
 * account, no network, no telemetry — local only (#43).
 *
 * Error messages name the failure, never the submitted source: callers can
 * print them without leaking code into logs.
 */
export async function runAnalysis(
  input: AnalysisInput,
): Promise<AnalysisOutcome> {
  const resolved = resolveLanguage({
    ...(input.language === undefined ? {} : { language: input.language }),
    ...(input.filename === undefined ? {} : { filename: input.filename }),
  });

  if (!resolved.ok) {
    return {
      ok: false,
      failure: { kind: "unknown-language", message: resolved.message },
    };
  }

  const subject = Subject.of({
    sourceCode: input.sourceCode,
    language: resolved.language,
  });

  // The language above is always non-blank by construction, so a failed
  // Subject can only mean the source itself is blank.
  if (!subject.ok) {
    return {
      ok: false,
      failure: { kind: "empty-source", message: subject.error.message },
    };
  }

  const analyze = new AnalyzeSubject(createRuleCatalog());
  const run = await analyze.execute({
    subject: subject.value,
    ...(input.ruleIds === undefined ? {} : { ruleIds: input.ruleIds }),
  });

  return { ok: true, run, language: resolved.language };
}
