#!/usr/bin/env bun
/**
 * Bundles the client islands into content-hashed files for immutable CDN
 * caching (ADR-0029).
 *
 * `gutter.ts` is the Phase 1 spike; `analyze-editor.ts` is the live
 * language detection and syntax highlighting for `/analyze`, loaded as a
 * `<script type="module">` only when the bundle exists — without it the
 * server-rendered form works as before. The manifest maps each logical
 * entry to its hashed file; the server answers hashed assets with
 * `CLIENT_ASSET_CACHE_CONTROL` (`public, max-age=31536000, immutable`),
 * which the CloudFront cache policy honours from the origin's headers, so
 * no Terraform change is needed for the new asset class.
 */
import { mkdir, rm } from "node:fs/promises";

const OUT_DIR = "infra/build/client";
const ENTRIES = [
  "packages/web/src/analyze/client/gutter.ts",
  "packages/web/src/analyze/client/analyze-editor.ts",
];

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

if (bundles.length !== ENTRIES.length) {
  throw new Error(
    `Expected ${ENTRIES.length} client bundles, got ${bundles.length}.`,
  );
}

const manifest: Record<string, string> = {};

for (const entry of ENTRIES) {
  const logical = entry.split("/").at(-1)?.replace(/\.ts$/, ".js");

  if (logical === undefined) {
    throw new Error(`Cannot derive a bundle name from ${entry}.`);
  }

  const hashed = bundles.find((file) => file.startsWith(logical.replace(/\.js$/, "-")));

  if (hashed === undefined) {
    throw new Error(`No bundle found for ${entry}.`);
  }

  manifest[logical] = hashed;
}

await Bun.write(`${OUT_DIR}/manifest.json`, `${JSON.stringify(manifest)}\n`);
console.log(`Built ${OUT_DIR}/manifest.json: ${JSON.stringify(manifest)}`);
