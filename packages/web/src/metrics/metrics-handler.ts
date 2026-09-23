import { INITIAL_WEB_METRICS_SUMMARY } from "@principled/core";
import type { WebMetricsSummary } from "@principled/core";
import { METRICS_CONTENT_TYPE, PAGE_CACHE_CONTROL } from "../shared/http.ts";

/**
 * Answers `GET /metrics` (#31): aggregates only — counts, failure rate,
 * latency percentiles and language/rule distributions. No source, prompts,
 * findings, repository names or user identifiers exist in the summary, so
 * this page is as cacheable as the other informational pages.
 */
export function handleMetricsRequest(
  readMetrics?: (() => WebMetricsSummary) | undefined,
): Response {
  const read = readMetrics ?? (() => INITIAL_WEB_METRICS_SUMMARY);

  return new Response(JSON.stringify(read()), {
    status: 200,
    headers: {
      "content-type": METRICS_CONTENT_TYPE,
      "cache-control": PAGE_CACHE_CONTROL,
    },
  });
}
