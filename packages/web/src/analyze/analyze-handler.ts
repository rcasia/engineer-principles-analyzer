import type {
  AnalysisResult,
  AnalyzeSubject,
  EventStore,
  LanguageDetector,
  WebMetricEvent,
} from "@principled/core";
import {
  InvalidJevResponseError,
  JevTransportError,
  Subject,
  UNKNOWN_LANGUAGE,
} from "@principled/core";
import type { ClientAssets } from "../shared/client-assets.ts";
import {
  ANALYSIS_CACHE_CONTROL,
  htmlResponse,
  jsonResponse,
  PAGE_CACHE_CONTROL,
} from "../shared/http.ts";
import { renderAnalyzePage } from "./analyze-page.ts";
import { toPlainResult } from "./analysis-payload.ts";
import { exampleFor } from "./code-examples.ts";

/** What the analyze slice needs from the composition root. */
export interface AnalyzeDependencies {
  /** Runs every registered rule against a submitted `Subject` (#9, #34). */
  readonly analyzeSubject: AnalyzeSubject;
  /**
   * Where an analysis run's events are appended after `analyzeSubject`
   * returns (ADR-0015) — facts about the run only, never the submitted
   * source, so the "not persisted by default" requirement holds regardless
   * of which concrete `EventStore` is wired in here.
   */
  readonly eventStore: EventStore;
  /**
   * Resolves a submission's language with Jev (ADR-0028) before the
   * `Subject` is built. Injected so tests script the judgment and the
   * composition roots (bin, lambda-entry) supply the HTTP client.
   */
  readonly languageDetector: LanguageDetector;
  /**
   * Hashed live-highlight bundle, when one was built (ADR-0029). Absent in
   * development without a client build — the form then renders with no
   * `<script>` tag and the no-JS baseline holds.
   */
  readonly clientAssets?: ClientAssets | undefined;
  /**
   * First-party, server-side metrics sink (#31). Optional so tests and
   * compositions without analytics keep working: unrecorded runs simply do
   * not contribute to the aggregates. Only minimized {@link WebMetricEvent}
   * facts ever reach it — never source, prompts or findings.
   */
  readonly recordMetric?: ((event: WebMetricEvent) => void) | undefined;
}

/** Hard bound for source plus multipart/JSON framing at the HTTP boundary. */
export const MAX_ANALYSIS_BODY_BYTES = 1_048_576;
const MAX_DETECT_BODY_BYTES = 65_536;
const BODY_TOO_LARGE_MESSAGE =
  "Submission too large. Keep the request under 1 MiB.";

async function bodyExceedsLimit(
  request: Request,
  limit: number,
): Promise<boolean> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null && Number(contentLength) > limit) {
    return true;
  }

  return (await request.clone().arrayBuffer()).byteLength > limit;
}

function oversizedAnalysisResponse(request: Request): Response {
  if (isLiveAnalysisRequest(request)) {
    return jsonResponse(
      { error: BODY_TOO_LARGE_MESSAGE },
      { status: 413, headers: { "cache-control": ANALYSIS_CACHE_CONTROL } },
    );
  }

  return htmlResponse(
    renderAnalyzePage({
      kind: "invalid",
      message: BODY_TOO_LARGE_MESSAGE,
      sourceCode: "",
      language: "",
    }),
    413,
    ANALYSIS_CACHE_CONTROL,
  );
}

/**
 * Bucket for metric events whose language could not be detected (#31,
 * ADR-0040): the public summary must never carry an empty-string language
 * key. Undetected submissions run as `"unknown"`, so both map there.
 */
export function metricLanguageOf(language: string): string {
  return language === "" ? UNKNOWN_LANGUAGE : language;
}

/** Reads a `FormDataEntryValue` as plain text, treating a missing field the same as an empty one. */
function textFieldOf(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/**
 * Resolves the single subject a submission describes: the uploaded file's
 * content when one was given, the pasted text otherwise. A visitor can use
 * either field, never both at once — there is no combination logic beyond
 * this preference, which is what keeps "exactly one file" true regardless
 * of what the visitor filled in (ADR-0015). The uploaded filename is kept
 * alongside as a hint for language detection; pasted text has no filename.
 */
interface SubmittedSource {
  readonly sourceCode: string;
  readonly filename: string | undefined;
}

async function sourceCodeOf(form: FormData): Promise<SubmittedSource> {
  const uploaded = form.get("sourceFile");

  if (uploaded instanceof File && uploaded.size > 0) {
    return { sourceCode: await uploaded.text(), filename: uploaded.name };
  }

  return {
    sourceCode: textFieldOf(form.get("sourceCode")),
    filename: undefined,
  };
}

/**
 * Asks Jev for one submission's language. Only Jev's own failures (the
 * network, the service, or the wire shape) resolve to `undefined` here —
 * anything else is a bug and still throws, so it cannot masquerade as an
 * ambiguous snippet.
 */
async function detectedLanguage(
  detector: LanguageDetector,
  sourceCode: string,
  filename: string | undefined,
): Promise<string | undefined> {
  try {
    return await detector.detectLanguage(sourceCode, filename);
  } catch (error) {
    if (
      error instanceof JevTransportError ||
      error instanceof InvalidJevResponseError
    ) {
      return undefined;
    }

    throw error;
  }
}

/**
 * What one analysis run settles to, however the submission arrived: either
 * the rejection message the visitor needs, or the detected language with
 * every rule's finding. Both the page render and the live JSON island
 * answer from this one outcome, so detection, validation, metrics and the
 * event-store append cannot drift between the two representations.
 */
type SettledAnalysis =
  | {
      readonly kind: "invalid";
      readonly message: string;
      readonly language: string;
    }
  | {
      readonly kind: "completed";
      readonly language: string;
      readonly results: readonly AnalysisResult[];
    };

async function settleAnalysis(
  sourceCode: string,
  filename: string | undefined,
  deps: Pick<
    AnalyzeDependencies,
    "analyzeSubject" | "eventStore" | "languageDetector" | "recordMetric"
  >,
): Promise<SettledAnalysis> {
  const recordMetric = deps.recordMetric ?? (() => {});
  const startedAt = Date.now();
  // Fully automatic: any `language` field in the form is ignored and the
  // effective language always comes from Jev over the source and filename.
  // An unidentified language never blocks (ADR-0040): Jev's `other`,
  // a Jev failure, or a missing key all degrade to `"unknown"` and the run
  // proceeds — heuristic rules analyze recognizable constructs generically
  // (ADR-0044) while Jev-backed rules judge the source generically.
  const language = (await detectedLanguage(
    deps.languageDetector,
    sourceCode,
    filename,
  )) ?? UNKNOWN_LANGUAGE;

  recordMetric({ kind: "analysis-requested" });

  const subject = Subject.of({ sourceCode, language });

  if (!subject.ok) {
    recordMetric({
      kind: "analysis-failed",
      language: metricLanguageOf(language),
      ruleIds: [],
      durationMs: Date.now() - startedAt,
    });
    // The language above is always non-blank by construction, so a failed
    // Subject can only mean the source itself is blank.
    return { kind: "invalid", message: subject.error.message, language };
  }

  try {
    const run = await deps.analyzeSubject.execute({ subject: subject.value });
    const ruleIds = run.results.map((result) => result.ruleId);
    recordMetric({
      kind: "analysis-completed",
      language,
      ruleIds,
      durationMs: Date.now() - startedAt,
    });
    await deps.eventStore.append(run.analysisId, 0, run.events);

    return { kind: "completed", language, results: run.results };
  } catch (error) {
    recordMetric({
      kind: "analysis-failed",
      language: metricLanguageOf(language),
      ruleIds: [],
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function handleAnalyzeSubmission(
  request: Request,
  deps: Pick<
    AnalyzeDependencies,
    "analyzeSubject" | "eventStore" | "languageDetector" | "clientAssets" | "recordMetric"
  >,
): Promise<Response> {
  if (await bodyExceedsLimit(request, MAX_ANALYSIS_BODY_BYTES)) {
    return oversizedAnalysisResponse(request);
  }

  const form = await request.formData();
  const { sourceCode, filename } = await sourceCodeOf(form);
  // Any `language` field in the form is ignored and the effective language
  // always comes from Jev over the source and filename.
  const settled = await settleAnalysis(sourceCode, filename, deps);

  if (settled.kind === "invalid") {
    return htmlResponse(
      renderAnalyzePage(
        {
          kind: "invalid",
          message: settled.message,
          sourceCode,
          language: settled.language,
        },
        { scriptSrc: deps.clientAssets?.scriptSrc },
      ),
      400,
      ANALYSIS_CACHE_CONTROL,
    );
  }

  return htmlResponse(
    renderAnalyzePage({ kind: "completed", results: settled.results }),
    200,
    ANALYSIS_CACHE_CONTROL,
  );
}

/**
 * The live island behind the realtime playground (ADR-0042) speaks JSON to
 * this path: the same `POST /analyze` route, selected by a JSON request
 * body rather than a new URL, so the edge signer (ADR-0019) and the
 * `no-store` cache semantics need no new infrastructure. Only an empty
 * buffer answers 400; an unidentified language runs as `"unknown"` with
 * 200 (ADR-0040) — only the representation differs from the page render.
 */
export function isLiveAnalysisRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type");

  return contentType !== null && contentType.includes("application/json");
}

export async function handleLiveAnalysisRequest(
  request: Request,
  deps: Pick<
    AnalyzeDependencies,
    "analyzeSubject" | "eventStore" | "languageDetector" | "recordMetric"
  >,
): Promise<Response> {
  if (await bodyExceedsLimit(request, MAX_ANALYSIS_BODY_BYTES)) {
    return oversizedAnalysisResponse(request);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "expected a JSON body with sourceCode" },
      {
        status: 400,
        headers: { "cache-control": ANALYSIS_CACHE_CONTROL },
      },
    );
  }

  // Object spread narrows without a branch: primitives and `null` spread
  // to no props, so every non-object body behaves as a blank buffer —
  // exactly what the guard it replaces did, but with no condition a mutant
  // could weaken.
  const fields: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };
  const sourceCode =
    typeof fields["sourceCode"] === "string" ? fields["sourceCode"] : "";
  const filenameRaw = fields["filename"];
  const filename =
    typeof filenameRaw === "string" ? filenameRaw : undefined;

  const settled = await settleAnalysis(sourceCode, filename, deps);

  if (settled.kind === "invalid") {
    return jsonResponse(
      { error: settled.message, language: settled.language },
      {
        status: 400,
        headers: { "cache-control": ANALYSIS_CACHE_CONTROL },
      },
    );
  }

  return jsonResponse(
    { language: settled.language, results: settled.results.map(toPlainResult) },
    { headers: { "cache-control": ANALYSIS_CACHE_CONTROL } },
  );
}

/**
 * Answers the live island's language lookup (`POST /detect`): the same Jev
 * judgment `POST /analyze` uses, but as JSON for the badge instead of a
 * verdict. The island calls it on paste and when a buffer loads unknown —
 * never per keystroke — so typing stays free and the credential never
 * leaves the server. Unknown and Jev failures both answer `""` with 200:
 * a preview that cannot tell simply keeps showing auto-detect.
 */
export async function handleDetectRequest(
  request: Request,
  deps: Pick<AnalyzeDependencies, "languageDetector">,
): Promise<Response> {
  if (await bodyExceedsLimit(request, MAX_DETECT_BODY_BYTES)) {
    return jsonResponse(
      { error: "Detection request too large." },
      { status: 413, headers: { "cache-control": ANALYSIS_CACHE_CONTROL } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "expected a JSON body with sourceCode" },
      {
        status: 400,
        headers: { "cache-control": ANALYSIS_CACHE_CONTROL },
      },
    );
  }

  // Object spread narrows without a branch: primitives and `null` spread
  // to no props, so every non-object body behaves as a blank buffer —
  // exactly what the guard it replaces did, but with no condition a mutant
  // could weaken.
  const fields: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };
  const sourceCode =
    typeof fields["sourceCode"] === "string" ? fields["sourceCode"] : "";
  const filenameRaw = fields["filename"];
  const filename =
    typeof filenameRaw === "string" ? filenameRaw : undefined;

  const language =
    (await detectedLanguage(deps.languageDetector, sourceCode, filename)) ??
    "";

  return jsonResponse(
    { language },
    { headers: { "cache-control": ANALYSIS_CACHE_CONTROL } },
  );
}

/**
 * Renders the `/analyze` playground for `GET`: blank, or prefilled when the
 * visitor followed a `?example=` link.
 */
export function handleAnalyzePage(
  searchParams: URLSearchParams,
  clientAssets: ClientAssets | undefined,
): Response {
  const scriptSrc = clientAssets?.scriptSrc;
  const example = exampleFor(searchParams.get("example"));

  if (example === undefined) {
    return htmlResponse(
      renderAnalyzePage(
        {
          kind: "form",
          sourceCode: "",
          language: "",
          exampleId: null,
        },
        { scriptSrc },
      ),
      200,
      PAGE_CACHE_CONTROL,
    );
  }

  // Prefilled by query, which the CDN cache key ignores: this response
  // must not be stored, or one visitor's example would be served to all.
  // The example's language is curated display content, not a judgment —
  // the live island re-detects through POST /detect on paste and when
  // the buffer loads unknown, so rendering an example never waits on
  // (or pays for) a Jev call.
  return htmlResponse(
    renderAnalyzePage(
      {
        kind: "form",
        sourceCode: example.source,
        language: example.language,
        exampleId: example.id,
      },
      { scriptSrc },
    ),
    200,
    ANALYSIS_CACHE_CONTROL,
  );
}
