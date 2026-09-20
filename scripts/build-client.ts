#!/usr/bin/env bun
/**
 * Bundles the client islands into content-hashed files for immutable CDN
 * caching (Phase 1 spike, #49).
 *
 * Phase 1 ships no `<script>` tag — the principles page stays SSR-only —
 * so nothing references this output yet. The point of the spike is proving
 * the pipeline: `Bun.build` hashes the bundle, the manifest maps the
 * logical entry to its hashed file, and the server answers hashed assets
 * with `CLIENT_ASSET_CACHE_CONTROL` (`public, max-age=31536000, immutable`),
 * which the CloudFront cache policy honours from the origin's headers, so
 * no Terraform change is needed for the new asset class.
 */
import { mkdir, rm } from "node:fs/promises";

const OUT_DIR = "infra/build/client";
const ENTRIES = ["packages/web/src/client/gutter.ts"];

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: ENTRIES,
  outdir: OUT_DIR,
  target: "browser",
  format: "esm",
  minify: true,
  naming: "[name]-[hash].[ext]",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error(`Failed to bundle client entries: ${ENTRIES.join(", ")}`);
}

const bundles = result.outputs
  .map((output) => output.path.split("/").at(-1))
  .filter((file): file is string => file !== undefined && file.endsWith(".js"));

if (bundles.length !== 1) {
  throw new Error(`Expected one client bundle, got ${bundles.length}.`);
}

const [bundle] = bundles;

if (bundle === undefined) {
  throw new Error("Expected one client bundle, found none.");
}

const manifest: Record<string, string> = { "gutter.js": bundle };

await Bun.write(`${OUT_DIR}/manifest.json`, `${JSON.stringify(manifest)}\n`);
console.log(`Built ${OUT_DIR}/manifest.json: ${JSON.stringify(manifest)}`);
