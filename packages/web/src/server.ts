import type {
  AnalyzeSubject,
  EventStore,
  LanguageDetector,
  ListPrinciples,
  WebMetricEvent,
  WebMetricsSummary,
} from "@principled/core";
import {
  INITIAL_WEB_METRICS_SUMMARY,
  InvalidJevResponseError,
  JevTransportError,
  Subject,
} from "@principled/core";
import type { ClientAssets } from "./client-assets.ts";
import { renderAnalyzePage } from "./presentation/analyze-page.ts";
import { exampleFor } from "./presentation/code-examples.ts";
import { renderDesignPlayground } from "./presentation/design-playground.tsx";
import { UNDETECTED_LANGUAGE_MESSAGE } from "./presentation/language-display.ts";
import { renderPrinciplesPage } from "./presentation/principles-page.ts";

export { UNDETECTED_LANGUAGE_MESSAGE };

export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const NOT_FOUND_BODY = "Not found";

/**
 * Cache directives are the whole reason the CDN in front of this is free and
 * fast: without them CloudFront revalidates on every request and the origin
 * is hit as often as if there were no cache at all. `stale-while-revalidate`
 * means a user never waits for a Lambda cold start on a warm path.
 */
export const PAGE_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=600";
export const NOT_FOUND_CACHE_CONTROL = "public, max-age=300";
/**
 * A submitted analysis is per-visitor and is not persisted server side
 * (#34, #28); the CDN and every intermediate cache must not store or reuse
 * either the form echo or the findings from one visitor's request. `private`
 * keeps a shared cache from serving one visitor's analysis to another even
 * where the CDN behavior for user-specific responses is misconfigured.
 */
export const ANALYSIS_CACHE_CONTROL = "no-store, private";
/**
 * Content-hashed client bundles from `scripts/build-client.ts` are immutable
 * by construction: a new build is a new file name, so caches never need to
 * revalidate. The `/assets/` route below serves them with this directive,
 * which the CloudFront cache policy honours from the origin's headers, so
 * no Terraform change is needed for the asset class.
 */
export const CLIENT_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

/**
 * Bucket for metric events whose language could not be detected (#31): the
 * public summary must never carry an empty-string language key.
 */
export function metricLanguageOf(language: string): string {
  return language === "" ? "undetected" : language;
}

export const CLIENT_ASSET_CONTENT_TYPE = "text/javascript; charset=utf-8";

export const METRICS_CONTENT_TYPE = "application/json; charset=utf-8";

/**
 * Serves a hashed client bundle by exact filename match only — the name
 * comes from the build manifest, never from request parsing — so any path
 * that is not a built bundle simply misses and routing continues to 404.
 */
function clientAssetResponse(
  assets: ClientAssets | undefined,
  pathname: string,
): Response | undefined {
  const source = assets?.files[pathname.slice("/assets/".length)];

  if (source === undefined) {
    return undefined;
  }

  return new Response(source, {
    status: 200,
    headers: {
      "content-type": CLIENT_ASSET_CONTENT_TYPE,
      "cache-control": CLIENT_ASSET_CACHE_CONTROL,
    },
  });
}

/** What `createRequestHandler` needs to serve every route. */
export interface RequestHandlerDependencies {
  readonly listPrinciples: ListPrinciples;
  /** Runs every registered rule against a submitted `Subject` (#9, #34). */
  readonly analyzeSubject: AnalyzeSubject;
  /**
   * Resolves a submission's language with Jev (ADR-0028) before the
   * `Subject` is built. Injected so tests script the judgment and the
   * composition roots (bin, lambda-entry) supply the HTTP client.
   */
  readonly languageDetector: LanguageDetector;
  /**
   * Where an analysis run's events are appended after `analyzeSubject`
   * returns (ADR-0015) — facts about the run only, never the submitted
   * source, so the "not persisted by default" requirement holds regardless
   * of which concrete `EventStore` is wired in here.
   */
   readonly eventStore: EventStore;
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
  /**
   * Reads the current metrics summary for `GET /metrics` (#31). The default
   * reports the empty summary; the Lambda composition root folds recorded
   * events through `WebMetrics` instead.
   */
  readonly readMetrics?: (() => WebMetricsSummary) | undefined;
}

function htmlResponse(
  body: string,
  status: number,
  cacheControl: string,
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": HTML_CONTENT_TYPE,
      "cache-control": cacheControl,
    },
  });
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

async function handleAnalyzeSubmission(
  request: Request,
  deps: Pick<
    RequestHandlerDependencies,
    "analyzeSubject" | "eventStore" | "languageDetector" | "clientAssets" | "recordMetric"
  >,
): Promise<Response> {
  const recordMetric = deps.recordMetric ?? (() => {});
  const startedAt = Date.now();
  const form = await request.formData();
  const { sourceCode, filename } = await sourceCodeOf(form);
  // Fully automatic: any `language` field in the form is ignored and the
  // effective language always comes from Jev over the source and filename.
  // A Jev failure degrades to "undetected" rather than a 500: the visitor
  // gets the same guidance as for an ambiguous snippet.
  const language = (await detectedLanguage(
    deps.languageDetector,
    sourceCode,
    filename,
  )) ?? "";

  recordMetric({ kind: "analysis-requested" });

  const subject = Subject.of({ sourceCode, language });

  if (!subject.ok) {
    recordMetric({
      kind: "analysis-failed",
      language: metricLanguageOf(language),
      ruleIds: [],
      durationMs: Date.now() - startedAt,
    });
    // A failed Subject with non-empty source can only mean detection drew
    // a blank (language ""), so the visitor needs the detection guidance;
    // an empty source always reports itself, whichever language came out.
    const message =
      sourceCode.trim().length === 0
        ? subject.error.message
        : UNDETECTED_LANGUAGE_MESSAGE;

    return htmlResponse(
      renderAnalyzePage(
        {
          kind: "invalid",
          message,
          sourceCode,
          language,
        },
        { scriptSrc: deps.clientAssets?.scriptSrc },
      ),
      400,
      ANALYSIS_CACHE_CONTROL,
    );
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

    return htmlResponse(
      renderAnalyzePage({ kind: "completed", results: run.results }),
      200,
      ANALYSIS_CACHE_CONTROL,
    );
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

/**
 * Answers the live island's language lookup (`POST /detect`): the same Jev
 * judgment `POST /analyze` uses, but as JSON for the badge instead of a
 * verdict. The island calls it on paste and when a buffer loads unknown —
 * never per keystroke — so typing stays free and the credential never
 * leaves the server. Unknown and Jev failures both answer `""` with 200:
 * a preview that cannot tell simply keeps showing auto-detect.
 */
async function handleDetectRequest(
  request: Request,
  deps: Pick<RequestHandlerDependencies, "languageDetector">,
): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "expected a JSON body with sourceCode" },
      {
        status: 400,
        headers: { "cache-control": ANALYSIS_CACHE_CONTROL },
      },
    );
  }

  const fields =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  const sourceCode =
    typeof fields["sourceCode"] === "string" ? fields["sourceCode"] : "";
  const filenameRaw = fields["filename"];
  const filename =
    typeof filenameRaw === "string" ? filenameRaw : undefined;

  const language =
    (await detectedLanguage(deps.languageDetector, sourceCode, filename)) ??
    "";

  return Response.json(
    { language },
    { headers: { "cache-control": ANALYSIS_CACHE_CONTROL } },
  );
}

/**
 * Driving adapter as a plain `Request -> Response` function. Keeping the
 * handler separate from `Bun.serve` means the whole web surface is tested
 * without binding a port.
 */
export function createRequestHandler(
  deps: RequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === "/design") {
      return htmlResponse(renderDesignPlayground(), 200, PAGE_CACHE_CONTROL);
    }

    if (pathname === "/metrics" && request.method === "GET") {
      // Aggregates only (#31): counts, failure rate, latency percentiles and
      // language/rule distributions. No source, prompts, findings, repository
      // names or user identifiers exist in the summary, so this page is as
      // cacheable as the other informational pages.
      const readMetrics = deps.readMetrics ?? (() => INITIAL_WEB_METRICS_SUMMARY);

      return new Response(JSON.stringify(readMetrics()), {
        status: 200,
        headers: {
          "content-type": METRICS_CONTENT_TYPE,
          "cache-control": PAGE_CACHE_CONTROL,
        },
      });
    }

    const asset = clientAssetResponse(deps.clientAssets, pathname);

    if (asset !== undefined) {
      return asset;
    }

    if (pathname === "/detect" && request.method === "POST") {
      return handleDetectRequest(request, deps);
    }

    if (pathname === "/analyze") {
      if (request.method === "POST") {
        return handleAnalyzeSubmission(request, deps);
      }

      const scriptSrc = deps.clientAssets?.scriptSrc;
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

    if (pathname !== "/") {
      return new Response(NOT_FOUND_BODY, {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": NOT_FOUND_CACHE_CONTROL,
        },
      });
    }

    return htmlResponse(
      renderPrinciplesPage(await deps.listPrinciples.execute()),
      200,
      PAGE_CACHE_CONTROL,
    );
  };
}
