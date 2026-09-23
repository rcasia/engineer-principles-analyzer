import type { ClientAssets } from "./client-assets.ts";

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
 * revalidate. The `/assets/` route serves them with this directive,
 * which the CloudFront cache policy honours from the origin's headers, so
 * no Terraform change is needed for the asset class.
 */
export const CLIENT_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

export const CLIENT_ASSET_CONTENT_TYPE = "text/javascript; charset=utf-8";

export const METRICS_CONTENT_TYPE = "application/json; charset=utf-8";

export function htmlResponse(
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

export function notFoundResponse(): Response {
  return new Response(NOT_FOUND_BODY, {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": NOT_FOUND_CACHE_CONTROL,
    },
  });
}

/**
 * Serves a hashed client bundle by exact filename match only — the name
 * comes from the build manifest, never from request parsing — so any path
 * that is not a built bundle simply misses and routing continues to 404.
 */
export function clientAssetResponse(
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
