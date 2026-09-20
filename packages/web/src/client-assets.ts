/**
 * Content-hashed client bundles the request handler can serve.
 *
 * `scripts/build-client.ts` writes `analyze-editor-<hash>.js` into a
 * directory; the composition roots (`bin.ts`, `lambda-entry.ts`) load it
 * from disk at startup and hand it here. Serving from memory keeps the
 * handler pure `(Request) -> Response` with no filesystem access per
 * request, and an absent bundle simply means no `<script>` tag — the
 * no-JS baseline keeps working (ADR-0027).
 */
export interface ClientAssets {
  /** Public path rendered into the `<script>` tag, e.g. `/assets/….js`. */
  readonly scriptSrc: string;
  /** Hashed filename to bundle source, served under `/assets/`. */
  readonly files: Readonly<Record<string, string>>;
}

const EDITOR_BUNDLE_PATTERN = /^analyze-editor-[a-zA-Z0-9]+\.js$/;

/**
 * Finds the editor bundle in a build directory and reads it. Returns
 * `undefined` when there is nothing loadable (never built, read failure),
 * so development without a client build still serves the plain form.
 */
export async function loadClientAssets(
  listDir: () => Promise<readonly string[]>,
  readFile: (name: string) => Promise<string>,
): Promise<ClientAssets | undefined> {
  let names: readonly string[];

  try {
    names = await listDir();
  } catch {
    return undefined;
  }

  const bundle = names.find((name) => EDITOR_BUNDLE_PATTERN.test(name));

  if (bundle === undefined) {
    return undefined;
  }

  let source: string;

  try {
    source = await readFile(bundle);
  } catch {
    return undefined;
  }

  if (source.length === 0) {
    return undefined;
  }

  return { scriptSrc: `/assets/${bundle}`, files: { [bundle]: source } };
}
