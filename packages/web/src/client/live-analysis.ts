/**
 * Realtime analysis for the `/analyze` playground (ADR-0040).
 *
 * Progressive enhancement only: without this island the form posts through
 * the `<noscript>` submit button and the server renders the findings page.
 * When the bundle loads, the button stays hidden and every pause in typing
 * (plus uploads and example switches) analyses the visible buffer through
 * the JSON representation of the same `POST /analyze` route — findings
 * render into the `aria-live` region with no navigation and no lost caret.
 *
 * One request per pause at most: empty buffers render the empty state with
 * no request, unchanged buffers never re-fire, rapid input collapses into
 * the latest buffer via debounce, and only the latest request id may
 * render, so a slow response can never paint over a newer buffer.
 *
 * Everything DOM-touching degrades to `false` when its elements are absent,
 * mirroring the editor island's contract.
 */
import {
  LIVE_STATUS_ANALYZING,
  LIVE_STATUS_ATTENTION,
  LIVE_STATUS_EMPTY,
  LIVE_STATUS_READY,
  type PlainResult,
} from "../presentation/analysis-payload.ts";
import {
  extensionFor,
  languageLabel,
} from "../presentation/language-display.ts";
import { byTag, selectedFilename } from "./dom.ts";
import {
  renderLiveAnalyzing,
  renderLiveEmpty,
  renderLiveError,
  renderLiveFindings,
} from "./live-findings.ts";
import { syncValidationEcho } from "./validation-echo.ts";

/** Debounce between the last keystroke and the live request. */
export const LIVE_ANALYSIS_DEBOUNCE_MS = 500;

/**
 * Shown when the service cannot be reached or answers something
 * unusable — the buffer is untouched in the editor, so this only ever
 * describes the transport, never the code.
 */
export const LIVE_FETCH_FAILED_MESSAGE =
  "Could not reach the analysis service — your code is safe in the editor; try again in a moment.";

export type LiveOutcome =
  | {
      readonly ok: true;
      readonly language: string;
      readonly results: readonly PlainResult[];
    }
  | { readonly ok: false; readonly error: string; readonly language: string };

/** One debounced analysis of the visible buffer. */
export type AnalyzeBuffer = (
  sourceCode: string,
  filename: string | undefined,
) => Promise<LiveOutcome>;

/**
 * Asks the server for one buffer's findings. Never throws: any failure —
 * network, status body, or wire shape — resolves to an `ok: false` outcome
 * carrying what the island should show, so a failed request parks the live
 * loop instead of breaking it.
 */
export async function fetchAnalysis(
  sourceCode: string,
  filename: string | undefined,
  fetchFn: typeof fetch,
): Promise<LiveOutcome> {
  try {
    const response = await fetchFn("/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ sourceCode, filename: filename ?? "" }),
    });

    if (!response.ok) {
      return failureOf(await readFailurePayload(response));
    }

    const payload: unknown = await response.json();
    // Object spread narrows without a branch: primitives and `null` spread
    // to no props, so every non-object body behaves as an unusable answer.
    const fields: Record<string, unknown> = {
      ...(payload as Record<string, unknown>),
    };
    const language =
      typeof fields["language"] === "string" ? fields["language"] : "";

    if (!Array.isArray(fields["results"])) {
      return { ok: false, error: LIVE_FETCH_FAILED_MESSAGE, language };
    }

    return {
      ok: true,
      language,
      results: fields["results"] as readonly PlainResult[],
    };
  } catch {
    return { ok: false, error: LIVE_FETCH_FAILED_MESSAGE, language: "" };
  }
}

async function readFailurePayload(response: Response): Promise<{
  readonly error: string;
  readonly language: string;
}> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { error: LIVE_FETCH_FAILED_MESSAGE, language: "" };
  }

  const fields: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };
  const rawError = fields["error"];
  const error =
    typeof rawError === "string" && rawError.length > 0
      ? rawError
      : LIVE_FETCH_FAILED_MESSAGE;
  const rawLanguage = fields["language"];
  const language =
    typeof rawLanguage === "string" ? rawLanguage : "";

  return { error, language };
}

function failureOf(failure: {
  readonly error: string;
  readonly language: string;
}): LiveOutcome {
  return { ok: false, error: failure.error, language: failure.language };
}

/** "0 lines" is unreachable here: empty buffers never reach the toolbar. */
function lineCountLabel(sourceCode: string): string {
  const count = sourceCode.split("\n").length;

  return count === 1 ? "1 line" : `${count} lines`;
}

interface LiveElements {
  readonly form: HTMLFormElement;
  readonly textarea: HTMLTextAreaElement;
  readonly results: HTMLElement;
  readonly status: HTMLElement;
  readonly badge: HTMLElement | null;
  readonly filename: HTMLElement | null;
  readonly meta: HTMLElement | null;
  readonly fileInput: HTMLInputElement | null;
}

interface LiveState {
  timer: ReturnType<typeof setTimeout> | undefined;
  requestId: number;
  lastSent: string;
}

function setStatus(elements: LiveElements, text: string): void {
  elements.status.textContent = text;
}

function renderEmpty(elements: LiveElements): void {
  elements.results.innerHTML = renderLiveEmpty();
  setStatus(elements, LIVE_STATUS_EMPTY);
}

function updateToolbar(
  elements: LiveElements,
  language: string,
  sourceCode: string,
): void {
  if (elements.badge !== null) {
    elements.badge.textContent = languageLabel(language);
  }

  if (elements.filename !== null) {
    elements.filename.textContent =
      elements.form.dataset["exampleFilename"] ??
      `snippet.${extensionFor(language)}`;
  }

  if (elements.meta !== null) {
    elements.meta.textContent = `${languageLabel(language)} · ${lineCountLabel(sourceCode)}`;
  }
}

function dispatchInput(textarea: HTMLTextAreaElement): void {
  const event = textarea.ownerDocument.createEvent("Event");
  event.initEvent("input", true, true);
  textarea.dispatchEvent(event);
}

/**
 * Enhances the server-rendered playground in place. Returns `true` when the
 * form, its textarea, the findings region and the status line were all
 * found and wired, `false` without touching anything otherwise.
 *
 * `analyze` is injected so tests script the lookup; `delayMs` is injected
 * so tests skip the production debounce.
 */
export function enhanceLiveAnalysis(
  root: Document | Element,
  analyze: AnalyzeBuffer,
  delayMs: number,
): boolean {
  const form = byTag<HTMLFormElement>(root, "form#analyzeForm", "FORM");

  if (form === null) {
    return false;
  }

  const textarea = byTag<HTMLTextAreaElement>(form, "#sourceCode", "TEXTAREA");
  const results = byTag<HTMLElement>(root, "#liveResults", "DIV");
  const status = byTag<HTMLElement>(root, "#analyzeStatus", "P");

  if (textarea === null || results === null || status === null) {
    return false;
  }

  const elements: LiveElements = {
    form,
    textarea,
    results,
    status,
    badge: byTag<HTMLElement>(form, "#editorLanguage", "SPAN"),
    filename: byTag<HTMLElement>(form, "#editorFilename", "SPAN"),
    meta: byTag<HTMLElement>(form, "#editorMeta", "P"),
    fileInput: byTag<HTMLInputElement>(form, "#sourceFile", "INPUT"),
  };
  const state: LiveState = { timer: undefined, requestId: 0, lastSent: "" };

  function renderOutcome(
    outcome: LiveOutcome,
    sourceCode: string,
    requestId: number,
  ): void {
    if (requestId !== state.requestId) {
      return;
    }

    updateToolbar(elements, outcome.language, sourceCode);

    if (!outcome.ok) {
      elements.results.innerHTML = renderLiveError(outcome.error);
      setStatus(elements, LIVE_STATUS_ATTENTION);
      return;
    }

    // The editor island echoes validation off its own language on every
    // keystroke, which lags the run (it never detects per keystroke by
    // design). Re-sync with the fresh language so a success clears the
    // stale banner instead of disagreeing with the badge; a rejection
    // leaves the editor's echo alone, which already says the same thing.
    syncValidationEcho(elements.form, sourceCode, outcome.language);
    elements.results.innerHTML = renderLiveFindings(outcome.results);
    setStatus(elements, LIVE_STATUS_READY);
  }

  async function run(): Promise<void> {
    const sourceCode = elements.textarea.value;

    if (sourceCode.trim().length === 0) {
      renderEmpty(elements);
      return;
    }

    if (sourceCode === state.lastSent) {
      return;
    }

    state.lastSent = sourceCode;
    state.requestId += 1;
    const requestId = state.requestId;
    setStatus(elements, LIVE_STATUS_ANALYZING);
    elements.results.innerHTML = renderLiveAnalyzing();

    renderOutcome(
      await analyze(sourceCode, selectedFilename(elements.fileInput)),
      sourceCode,
      requestId,
    );
  }

  function schedule(): void {
    if (elements.textarea.value.trim().length === 0) {
      if (state.timer !== undefined) {
        clearTimeout(state.timer);
        state.timer = undefined;
      }

      state.requestId += 1;
      state.lastSent = elements.textarea.value;
      renderEmpty(elements);
      return;
    }

    if (state.timer !== undefined) {
      clearTimeout(state.timer);
    }

    state.timer = setTimeout(() => {
      state.timer = undefined;
      void run();
    }, delayMs);
  }

  textarea.addEventListener("input", schedule);
  elements.fileInput?.addEventListener("change", () => {
    const file = elements.fileInput?.files?.[0];

    if (file === undefined) {
      schedule();
      return;
    }

    void file
      .text()
      .then((text) => {
        textarea.value = text;
        // The editor island re-renders highlight, gutter and counts off
        // this event; the explicit schedule below analyses regardless of
        // whether that island is present.
        dispatchInput(textarea);
        schedule();
      })
      .catch(() => {
        state.requestId += 1;
        elements.results.innerHTML = renderLiveError(
          LIVE_FETCH_FAILED_MESSAGE,
        );
        setStatus(elements, LIVE_STATUS_ATTENTION);
      });
  });

  // The editor island owns example filling (and the plain navigation
  // without it): this listener only schedules the analysis after the fill,
  // so without the editor the navigation still happens untouched.
  for (const link of Array.from(root.querySelectorAll(".examples a"))) {
    link.addEventListener("click", () => {
      globalThis.setTimeout(schedule, 0);
    });
  }

  schedule();

  return true;
}
