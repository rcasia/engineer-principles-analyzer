#!/usr/bin/env bun
/**
 * Bundles the Lambda@Edge origin-request signer into
 * infra/build/edge-signer.zip.
 *
 * Same deal as build-lambda.ts: Bun is the bundler, Node is the runtime.
 * Two edge-specific constraints shape this bundle: Lambda@Edge forbids
 * environment variables (deploy-time values travel as origin custom headers
 * instead - see ORIGIN_HOST_HEADER), and the bundle is CommonJS rather than
 * ESM (spike-proven on nodejs22.x; ESM handler support on Lambda@Edge is
 * not something to discover in production).
 */
import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";

const OUT_DIR = "infra/build";
const ENTRY = "packages/edge-signer/src/index.ts";

await mkdir(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT_DIR,
  target: "node",
  format: "cjs",
  minify: true,
  naming: "signer.cjs",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error(`Failed to bundle ${ENTRY}`);
}

await rm(`${OUT_DIR}/edge-signer.zip`, { force: true });
await $`zip -j -q ${OUT_DIR}/edge-signer.zip ${OUT_DIR}/signer.cjs`;

const { size } = await Bun.file(`${OUT_DIR}/edge-signer.zip`).stat();
console.log(`Built ${OUT_DIR}/edge-signer.zip (${(size / 1024).toFixed(1)} kB)`);
