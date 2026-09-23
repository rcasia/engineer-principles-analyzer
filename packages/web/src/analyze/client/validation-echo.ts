/**
 * Client-side validation echo for the `/analyze` playground (Phase 2, #50).
 *
 * Progressive enhancement only: the server remains the single validation
 * path — the form always submits and `POST /analyze` re-validates from
 * scratch with its own Jev judgment. When the bundle loads, the island
 * mirrors what the server *would* say about the current buffer on every
 * render, so the visitor learns without a submit round trip that an empty
 * buffer cannot be submitted. An unidentified language never blocks
 * (ADR-0040): it runs as `"unknown"`, so the echo stays silent for it.
 *
 * Agreement by construction, not by review: validity comes from the same
 * core `Subject.of` the submission path uses, with the same
 * `"unknown"` fallback for a blank language. The banner uses the
 * exact server markup (`div.field__error` with `role="alert"`, wired to
 * the textarea through `aria-invalid` / `aria-describedby`), so a
 * server-rendered banner is adopted in place and never duplicated.
 *
 * No telemetry, no network: this module performs no `fetch`, `XHR`,
 * `sendBeacon`, or image-ping calls of its own — it only reads the buffer
 * and writes text. The only payload that ever leaves the browser is the
 * editor's existing language lookup and the submit itself. Visitor source
 * never reaches markup: the message is set through `textContent`, never
 * `innerHTML`.
 */
import { Subject, UNKNOWN_LANGUAGE } from "@principled/core";
import { byTag } from "./dom.ts";

/** Element id the server gives its validation banner; the echo reuses it. */
export const VALIDATION_ERROR_ID = "analyze-error";

/**
 * The message the server would reject this buffer with, or `undefined`
 * when it would accept it. Mirrors `handleAnalyzeSubmission`'s branching
 * exactly: a `Subject` decides validity with the same `"unknown"` fallback
 * for a blank language, so only an empty buffer reports an error and an
 * unidentified language stays submittable (ADR-0040).
 */
export function validationMessageOf(
  sourceCode: string,
  language: string,
): string | undefined {
  const effective =
    language.trim().length === 0 ? UNKNOWN_LANGUAGE : language;
  const subject = Subject.of({ sourceCode, language: effective });

  if (subject.ok) {
    return undefined;
  }

  return subject.error.message;
}

function errorScopeOf(form: HTMLFormElement): Document | Element {
  return form.parentElement ?? form.ownerDocument;
}

/**
 * Syncs the validation echo beside the form with the current buffer and
 * island language: ensures a `role="alert"` banner carrying the rejection
 * message while the buffer is invalid (adopting a server-rendered banner in
 * place, replacing a mistagged impostor), and removes the banner and the
 * invalid markers once the buffer becomes submittable.
 *
 * Returns `true` when a form with its textarea was found and synced,
 * `false` without touching anything otherwise.
 */
export function syncValidationEcho(
  form: HTMLFormElement | null,
  sourceCode: string,
  language: string,
): boolean {
  if (form === null || form.tagName !== "FORM") {
    return false;
  }

  const textarea = byTag<HTMLTextAreaElement>(form, "#sourceCode", "TEXTAREA");

  if (textarea === null) {
    return false;
  }

  const scope = errorScopeOf(form);
  const message = validationMessageOf(sourceCode, language);
  const existing = scope.querySelector(`#${VALIDATION_ERROR_ID}`);

  if (message === undefined) {
    existing?.remove();
    textarea.removeAttribute("aria-invalid");
    textarea.removeAttribute("aria-describedby");
    return true;
  }

  textarea.setAttribute("aria-invalid", "true");
  textarea.setAttribute("aria-describedby", VALIDATION_ERROR_ID);

  if (existing !== null && existing.tagName === "DIV") {
    existing.className = "field__error";
    existing.setAttribute("role", "alert");
    existing.textContent = message;
    return true;
  }

  existing?.remove();
  const banner = form.ownerDocument.createElement("div");
  banner.className = "field__error";
  banner.id = VALIDATION_ERROR_ID;
  banner.setAttribute("role", "alert");
  banner.textContent = message;
  form.before(banner);
  return true;
}
