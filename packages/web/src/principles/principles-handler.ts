import type { ListPrinciples } from "@principled/core";
import { htmlResponse, PAGE_CACHE_CONTROL } from "../shared/http.ts";
import { renderPrinciplesPage } from "./principles-page.ts";

/**
 * Answers `GET /principles`: the engineering contract — what the analyzer
 * measures code against — rendered with no client-side JavaScript.
 */
export async function handlePrinciplesRequest(
  listPrinciples: ListPrinciples,
): Promise<Response> {
  return htmlResponse(
    renderPrinciplesPage(await listPrinciples.execute()),
    200,
    PAGE_CACHE_CONTROL,
  );
}
