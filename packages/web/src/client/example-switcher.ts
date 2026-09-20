/**
 * Reload-free example switching for the `/analyze` playground (Phase 2,
 * #50).
 *
 * Progressive enhancement only: every "Try an example" link remains a plain
 * `GET /analyze?example=<id>` navigation that the server prefills, so the
 * playground is fully usable with scripting disabled. When the bundle
 * loads, clicks fill the editor in place instead — no reload, no round
 * trip — and the editor re-renders around the new buffer.
 *
 * Single source of truth: examples resolve through the same `exampleFor`
 * the server prefills with, so the island can never fill a buffer the
 * server would not serve. Anything the island cannot handle (unknown id,
 * missing editor) falls through to the plain navigation by simply not
 * calling `preventDefault`.
 *
 * No telemetry, no network of its own: this module only reads links and
 * writes the textarea. Any language refresh after a switch is the editor
 * island's `onSwitch` hook, not this module's doing.
 */
import { exampleFor } from "../presentation/code-examples.ts";
import { byTag } from "./dom.ts";

export interface ExampleSwitchHooks {
  /**
   * Runs after the buffer is filled — the editor island passes a re-render
   * plus language refresh. Defaults to dispatching a bubbling `input`
   * event on the textarea, which re-renders through the editor's own
   * listener when one is wired and is harmless otherwise.
   */
  readonly onSwitch?: ((textarea: HTMLTextAreaElement) => void) | undefined;
}

function exampleIdOf(href: string): string | null {
  try {
    return new URL(href, "http://localhost").searchParams.get("example");
  } catch {
    return null;
  }
}

/** Example links only: anchors with an `href` inside the examples section. */
function exampleLinksOf(root: Document | Element): readonly HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll(".examples a")).filter(
    (link): link is HTMLAnchorElement =>
      link.tagName === "A" && link.hasAttribute("href"),
  );
}

function markCurrent(
  links: readonly HTMLAnchorElement[],
  current: HTMLAnchorElement,
): void {
  for (const link of links) {
    link.removeAttribute("aria-current");
  }

  current.setAttribute("aria-current", "true");
}

function dispatchInput(textarea: HTMLTextAreaElement): void {
  const event = textarea.ownerDocument.createEvent("Event");
  event.initEvent("input", true, true);
  textarea.dispatchEvent(event);
}

/**
 * Wires reload-free example switching under `root`. Returns `true` when at
 * least one example link was found and wired, `false` without touching
 * anything otherwise. A wired click that cannot be served (unknown example,
 * no editor) keeps the plain navigation.
 */
export function enhanceExampleSwitching(
  root: Document | Element,
  hooks?: ExampleSwitchHooks | undefined,
): boolean {
  const links = exampleLinksOf(root);

  if (links.length === 0) {
    return false;
  }

  for (const link of links) {
    link.addEventListener("click", (event) => {
      const id = exampleIdOf(link.getAttribute("href") ?? "");
      const example = id === null ? undefined : exampleFor(id);
      const form = byTag<HTMLFormElement>(root, "form#analyzeForm", "FORM");
      const textarea =
        form === null
          ? null
          : byTag<HTMLTextAreaElement>(form, "#sourceCode", "TEXTAREA");

      if (example === undefined || form === null || textarea === null) {
        return;
      }

      event.preventDefault();
      textarea.value = example.source;

      // A pasted buffer and an upload are mutually exclusive server side
      // (the upload wins when present), so switching examples drops any
      // chosen file — otherwise the fill would silently lose on submit.
      const fileInput = byTag<HTMLInputElement>(form, "#sourceFile", "INPUT");

      if (fileInput !== null) {
        fileInput.value = "";
      }

      form.dataset["exampleFilename"] = example.filename;
      markCurrent(links, link);

      if (hooks?.onSwitch !== undefined) {
        hooks.onSwitch(textarea);
      } else {
        dispatchInput(textarea);
      }
    });
  }

  return true;
}
