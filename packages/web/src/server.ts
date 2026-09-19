import type { ListPrinciples } from "@epa/core";
import { renderPrinciplesPage } from "./presentation/principles-page.ts";

export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const NOT_FOUND_BODY = "Not found";

/**
 * Driving adapter as a plain `Request -> Response` function. Keeping the
 * handler separate from `Bun.serve` means the whole web surface is tested
 * without binding a port.
 */
export function createRequestHandler(
  listPrinciples: ListPrinciples,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);

    if (pathname !== "/") {
      return new Response(NOT_FOUND_BODY, {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(renderPrinciplesPage(await listPrinciples.execute()), {
      status: 200,
      headers: { "content-type": HTML_CONTENT_TYPE },
    });
  };
}
