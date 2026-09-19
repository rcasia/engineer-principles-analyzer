import type { AnalyzeSubject, EventStore, ListPrinciples } from "@principled/core";
import { Subject } from "@principled/core";
import { renderAnalyzePage } from "./presentation/analyze-page.ts";
import { renderDesignPlayground } from "./presentation/design-playground.ts";
import { renderPrinciplesPage } from "./presentation/principles-page.ts";

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
 * either the form echo or the findings from one visitor's request.
 */
export const ANALYSIS_CACHE_CONTROL = "no-store";

/** What `createRequestHandler` needs to serve every route. */
export interface RequestHandlerDependencies {
  readonly listPrinciples: ListPrinciples;
  /** Runs every registered rule against a submitted `Subject` (#9, #34). */
  readonly analyzeSubject: AnalyzeSubject;
  /**
   * Where an analysis run's events are appended after `analyzeSubject`
   * returns (ADR-0015) — facts about the run only, never the submitted
   * source, so the "not persisted by default" requirement holds regardless
   * of which concrete `EventStore` is wired in here.
   */
  readonly eventStore: EventStore;
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
 * of what the visitor filled in (ADR-0015).
 */
async function sourceCodeOf(form: FormData): Promise<string> {
  const uploaded = form.get("sourceFile");

  if (uploaded instanceof File && uploaded.size > 0) {
    return await uploaded.text();
  }

  return textFieldOf(form.get("sourceCode"));
}

async function handleAnalyzeSubmission(
  request: Request,
  deps: Pick<RequestHandlerDependencies, "analyzeSubject" | "eventStore">,
): Promise<Response> {
  const form = await request.formData();
  const sourceCode = await sourceCodeOf(form);
  const language = textFieldOf(form.get("language"));

  const subject = Subject.of({ sourceCode, language });

  if (!subject.ok) {
    return htmlResponse(
      renderAnalyzePage({
        kind: "invalid",
        message: subject.error.message,
        sourceCode,
        language,
      }),
      400,
      ANALYSIS_CACHE_CONTROL,
    );
  }

  const run = await deps.analyzeSubject.execute({ subject: subject.value });
  await deps.eventStore.append(run.analysisId, 0, run.events);

  return htmlResponse(
    renderAnalyzePage({ kind: "completed", results: run.results }),
    200,
    ANALYSIS_CACHE_CONTROL,
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
    const { pathname } = new URL(request.url);

    if (pathname === "/design") {
      return htmlResponse(renderDesignPlayground(), 200, PAGE_CACHE_CONTROL);
    }

    if (pathname === "/analyze") {
      if (request.method === "POST") {
        return handleAnalyzeSubmission(request, deps);
      }

      return htmlResponse(
        renderAnalyzePage({ kind: "form" }),
        200,
        PAGE_CACHE_CONTROL,
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
