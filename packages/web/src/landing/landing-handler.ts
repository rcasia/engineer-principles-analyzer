import { htmlResponse, PAGE_CACHE_CONTROL } from "../shared/http.ts";
import { renderLandingPage } from "./landing-page.ts";

/**
 * Answers `GET /`: what Principled is, the gap it fills next to
 * deterministic tooling, and where to try it.
 */
export function handleLandingRequest(): Response {
  return htmlResponse(renderLandingPage(), 200, PAGE_CACHE_CONTROL);
}
