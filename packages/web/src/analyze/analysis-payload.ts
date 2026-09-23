/**
 * The JSON representation `POST /analyze` speaks when the request carries a
 * JSON body (ADR-0042): the live island's realtime analysis without a submit
 * round trip. HTML form posts keep rendering full pages exactly as before;
 * JSON posts get minimized facts with `no-store` caching, the same metrics
 * and the same event-store append as the page render.
 *
 * Dependency-free on purpose: the browser bundle imports the message
 * constants and the response shapes from here (`import type` for the
 * shapes, values for the strings), so the status line and the empty states
 * cannot drift between server and island. The only runtime import is
 * `import type` from core, which is erased at build time.
 */
import type { AnalysisResult } from "@principled/core";

/** Plain-data location inside one finding's evidence. */
export interface PlainLocation {
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn?: number | undefined;
  readonly filePath?: string | undefined;
}

/** Plain-data evidence inside one finding. */
export interface PlainEvidence {
  readonly location: PlainLocation;
  readonly excerpt: string;
}

/**
 * Plain-data view of one `AnalysisResult` for the live JSON response.
 * Mirrors the CLI's `toPlainResult` field for field (the web cannot import
 * from the CLI package): JSON-safe, method-free, and free of the submitted
 * source, which never belongs in machine-readable output (#28).
 */
export interface PlainResult {
  readonly ruleId: string;
  readonly status: string;
  readonly confidence: number;
  readonly method: string;
  readonly evidence: readonly PlainEvidence[];
  readonly explanation: string;
  readonly remediation?: string | undefined;
  readonly language: string;
  readonly analyzer: { readonly name: string; readonly version: string };
  readonly limitations: readonly string[];
  readonly humanReviewRecommended: boolean;
  readonly evaluationMetadata?: Readonly<Record<string, string>> | undefined;
}

/** A completed live run: the detected language plus one entry per finding. */
export interface LiveAnalysisSuccess {
  readonly language: string;
  readonly results: readonly PlainResult[];
}

/** A rejected live run: why, plus the language that was detected, if any. */
export interface LiveAnalysisFailure {
  readonly error: string;
  readonly language: string;
}

/**
 * Shown in the empty findings region before the first keystroke lands:
 * the page analyses as you type, so an empty editor is the only state with
 * nothing to show yet.
 */
export const LIVE_RESULTS_EMPTY_MESSAGE =
  "Findings appear here as you type — paste code, upload a file, or try an example.";

/** Toolbar status while the buffer is empty: nothing has been asked yet. */
export const LIVE_STATUS_EMPTY = "Waiting for code.";

/** Toolbar status while a debounced request is pending or in flight. */
export const LIVE_STATUS_ANALYZING = "Analyzing…";

/** Toolbar status once the visible findings match the visible buffer. */
export const LIVE_STATUS_READY = "Findings up to date.";

/**
 * Toolbar status when the latest run was rejected (undetectable language,
 * unreachable service): the findings region carries the full message, the
 * status line only says the live loop is parked.
 */
export const LIVE_STATUS_ATTENTION = "Analysis paused — see below.";

/**
 * Empty-run wording shared by the server findings page and the live
 * island: a completed run with zero findings means no rule had anything to
 * say, not that the code is perfect.
 */
export const NO_FINDINGS_MESSAGE =
  "The analysis completed, but no rules were available to evaluate this submission.";

/**
 * The probabilistic-finding disclosure shared by the server findings page
 * and the live island: heuristic and AI-assisted verdicts must never read
 * as compiler errors.
 */
export const PROBABILISTIC_NOTE =
  "Findings are heuristic or AI-assisted judgments, not compiler errors. Confirm before acting.";

/**
 * Plain-data view of one `AnalysisResult` for JSON output. Every optional
 * field is omitted when absent rather than serialized as `undefined`, so
 * the wire shape stays tight and `JSON.stringify` round-trips exactly.
 */
export function toPlainResult(result: AnalysisResult): PlainResult {
  return {
    ruleId: result.ruleId,
    status: result.status,
    confidence: result.confidence.value,
    method: result.method,
    evidence: result.evidence.map((item) => ({
      location: {
        startLine: item.location.startLine,
        endLine: item.location.endLine,
        ...(item.location.startColumn === undefined
          ? {}
          : { startColumn: item.location.startColumn }),
        ...(item.location.filePath === undefined
          ? {}
          : { filePath: item.location.filePath }),
      },
      excerpt: item.excerpt,
    })),
    explanation: result.explanation,
    ...(result.remediation === undefined
      ? {}
      : { remediation: result.remediation }),
    language: result.language,
    analyzer: {
      name: result.analyzer.name,
      version: result.analyzer.version,
    },
    limitations: [...result.limitations],
    humanReviewRecommended: result.humanReviewRecommended,
    ...(result.evaluationMetadata === undefined
      ? {}
      : { evaluationMetadata: { ...result.evaluationMetadata } }),
  };
}
