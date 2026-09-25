import { htmlResponse, PAGE_CACHE_CONTROL } from "../shared/http.ts";
import {
  LEGAL_PAGE_PATHS,
  renderLegalConfigurationError,
  renderLegalPage,
  type LegalContact,
  type LegalPagePath,
} from "./legal-page.ts";

export function isLegalPagePath(path: string): path is LegalPagePath {
  return (LEGAL_PAGE_PATHS as readonly string[]).includes(path);
}

export function handleLegalRequest(
  path: LegalPagePath,
  contact: LegalContact | undefined,
): Response {
  if (contact === undefined) {
    return htmlResponse(renderLegalConfigurationError(), 503, "no-store");
  }

  return htmlResponse(renderLegalPage(path, contact), 200, PAGE_CACHE_CONTROL);
}
