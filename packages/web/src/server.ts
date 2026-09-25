import type {
  AnalyzeSubject,
  EventStore,
  LanguageDetector,
  ListPrinciples,
  WebMetricEvent,
  WebMetricsSummary,
} from "@principled/core";
import {
  handleAnalyzePage,
  handleAnalyzeSubmission,
  handleDetectRequest,
  handleLiveAnalysisRequest,
  isLiveAnalysisRequest,
} from "./analyze/analyze-handler.ts";
import { handleDesignRequest } from "./design/design-handler.ts";
import { handleLandingRequest } from "./landing/landing-handler.ts";
import { handleMetricsRequest } from "./metrics/metrics-handler.ts";
import { handlePrinciplesRequest } from "./principles/principles-handler.ts";
import {
  handleLegalRequest,
  isLegalPagePath,
} from "./legal/legal-handler.ts";
import type { LegalContact } from "./legal/legal-page.ts";
import type { ClientAssets } from "./shared/client-assets.ts";
import { clientAssetResponse, notFoundResponse } from "./shared/http.ts";

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
  /** Public legal pages are enabled only when deployment identity is complete. */
  readonly legalContact?: LegalContact | undefined;
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

/**
 * Driving adapter as a plain `Request -> Response` function. Keeping the
 * handler separate from `Bun.serve` means the whole web surface is tested
 * without binding a port. Each vertical slice owns its routes — this
 * function only composes them (ADR-0002).
 */
export function createRequestHandler(
  deps: RequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const { pathname, searchParams } = new URL(request.url);

    if (pathname === "/design") {
      return handleDesignRequest();
    }

    if (isLegalPagePath(pathname)) {
      return handleLegalRequest(pathname, deps.legalContact);
    }

    if (pathname === "/metrics" && request.method === "GET") {
      return handleMetricsRequest(deps.readMetrics);
    }

    if (pathname === "/principles") {
      return handlePrinciplesRequest(deps.listPrinciples);
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
        if (isLiveAnalysisRequest(request)) {
          return handleLiveAnalysisRequest(request, deps);
        }

        return handleAnalyzeSubmission(request, deps);
      }

      return handleAnalyzePage(searchParams, deps.clientAssets);
    }

    if (pathname !== "/") {
      return notFoundResponse();
    }

    return handleLandingRequest();
  };
}

// Canonical homes for the shared HTTP surface (`./shared/http.ts`) and the
// analyze slice (`./analyze/analyze-handler.ts`); re-exported here so
// existing deep imports keep working.
export {
  ANALYSIS_CACHE_CONTROL,
  CLIENT_ASSET_CACHE_CONTROL,
  CLIENT_ASSET_CONTENT_TYPE,
  HTML_CONTENT_TYPE,
  METRICS_CONTENT_TYPE,
  NOT_FOUND_BODY,
  NOT_FOUND_CACHE_CONTROL,
  PAGE_CACHE_CONTROL,
  SECURITY_HEADERS,
} from "./shared/http.ts";
export { metricLanguageOf } from "./analyze/analyze-handler.ts";
