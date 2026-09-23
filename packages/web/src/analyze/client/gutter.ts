/**
 * Editor gutter logic for the `/analyze` playground, Phase 1 spike (#49).
 *
 * These are the pure pieces Phase 2 will hydrate: line-number derivation
 * that the server already renders statically, plus the DOM write that will
 * become a client island. They ship as SSR HTML today — no `<script>` tag
 * references them — so `hydrateGutter` degrades to a no-op without a gutter
 * element, which is exactly the no-JS baseline ADR-0004 requires.
 */

/** 1-based line numbers for a buffer: `""` -> `[]`, `"a"` -> `[1]`. */
export function lineNumbersOf(sourceCode: string): readonly number[] {
  if (sourceCode === "") {
    return [];
  }

  return sourceCode.split("\n").map((_, index) => index + 1);
}

/**
 * Writes line numbers into a gutter element and returns how many were
 * written. Emits the same `<span>`-per-line markup the server renders, so
 * hydrated output is identical to SSR output for the same buffer. Only the
 * derived numbers are written — never the source text — so hostile input
 * cannot inject markup. Returns `0` without touching anything when there
 * is no gutter element (SSR output, scripting disabled).
 */
export function hydrateGutter(gutter: unknown, sourceCode: string): number {
  if (
    typeof gutter !== "object" ||
    gutter === null ||
    !("innerHTML" in gutter) ||
    typeof (gutter as { innerHTML: unknown }).innerHTML !== "string"
  ) {
    return 0;
  }

  const numbers = lineNumbersOf(sourceCode);
  (gutter as { innerHTML: string }).innerHTML = numbers
    .map((line) => `<span>${line}</span>`)
    .join("");
  return numbers.length;
}
