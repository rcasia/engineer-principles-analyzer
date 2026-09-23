import { htmlResponse, PAGE_CACHE_CONTROL } from "../shared/http.ts";
import { renderDesignPlayground } from "./design-playground.tsx";

/**
 * Answers `GET /design`: the internal design reference, rendered as static
 * HTML with no `<script>` tag.
 */
export function handleDesignRequest(): Response {
  return htmlResponse(renderDesignPlayground(), 200, PAGE_CACHE_CONTROL);
}
