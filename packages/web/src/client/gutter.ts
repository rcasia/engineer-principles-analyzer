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
 * written. Returns `0` without touching anything when there is no gutter
 * element (SSR output, scripting disabled).
 */
export function hydrateGutter(gutter: unknown, sourceCode: string): number {
  if (
    typeof gutter !== "object" ||
    gutter === null ||
    !("textContent" in gutter)
  ) {
    return 0;
  }

  const numbers = lineNumbersOf(sourceCode);
  (gutter as { textContent: string }).textContent = numbers.join("\n");
  return numbers.length;
}
