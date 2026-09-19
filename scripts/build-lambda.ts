#!/usr/bin/env bun
/**
 * Bundles the web Lambda entry point into infra/build/handler.zip.
 *
 * Bun is the bundler, Node is the runtime: Lambda has a managed Node runtime
 * on arm64 and no managed Bun one, so shipping a Node bundle avoids
 * maintaining a custom runtime layer. See docs/adr/0005.
 */
import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";

const OUT_DIR = "infra/build";
const ENTRY = "packages/web/src/lambda-entry.ts";

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT_DIR,
  target: "node",
  format: "esm",
  minify: true,
  naming: "handler.mjs",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error(`Failed to bundle ${ENTRY}`);
}

await $`zip -j -q ${OUT_DIR}/handler.zip ${OUT_DIR}/handler.mjs`;

const { size } = await Bun.file(`${OUT_DIR}/handler.zip`).stat();
console.log(`Built ${OUT_DIR}/handler.zip (${(size / 1024).toFixed(1)} kB)`);
