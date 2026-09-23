/**
 * Tag-checked element lookup shared by the `/analyze` client islands.
 *
 * `querySelector` alone cannot tell a `<div id="sourceCode">` from the real
 * textarea, and an island must not wire the wrong node: a hydration
 * mismatch (server HTML vs the elements the island expects) degrades to
 * `null` here, and every island treats `null` as "do not touch anything",
 * which is exactly the no-JS baseline behaviour.
 */
export function byTag<T extends Element>(
  parent: Document | Element,
  selector: string,
  tag: string,
): T | null {
  const found = parent.querySelector(selector);

  if (found === null || found.tagName !== tag) {
    return null;
  }

  return found as T;
}

/**
 * Uploaded filename, or `undefined` when no file is chosen. Shared by the
 * editor island (the detection hint) and the live island (the analysis
 * hint), so both read the same input the same way.
 */
export function selectedFilename(
  fileInput: {
    readonly files: ArrayLike<{ readonly name: string }> | null | undefined;
  } | null,
): string | undefined {
  return fileInput?.files?.[0]?.name;
}
