#!/usr/bin/env bun
/**
 * Bundles the web Lambda entry point into infra/build/handler.zip.
 *
 * Bun is the bundler, Node is the runtime: Lambda has a managed Node runtime
 * on arm64 and no managed Bun one, so shipping a Node bundle avoids
 * maintaining a custom runtime layer. See docs/adr/0005.
 *
 * The released web version from packages/web/package.json is stamped over
 * the `0.0.0-dev` placeholder from packages/web/src/version.ts, mirroring
 * Client bundles from scripts/build-client.ts ship beside the handler in
 * the same zip (ADR-0027): only handler files are cleaned here, never the
 * client directory, and the zip gains every built `*.js` asset.
 */
import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";

const OUT_DIR = "infra/build";
const CLIENT_DIR = `${OUT_DIR}/client`;
const ENTRY = "packages/web/src/lambda-entry.ts";
const OUT_FILE = `${OUT_DIR}/handler.mjs`;
const VERSION_PLACEHOLDER = "0.0.0-dev";

const { version } = await Bun.file("packages/web/package.json").json();

await rm(OUT_FILE, { force: true });
await rm(`${OUT_DIR}/handler.zip`, { force: true });
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

// Stamp the released version into the bundle. Fail loudly rather than
// serve pages that lie about which version they are.
const bundle = await Bun.file(OUT_FILE).text();

if (!bundle.includes(VERSION_PLACEHOLDER)) {
  throw new Error(
    `Version placeholder "${VERSION_PLACEHOLDER}" not found in ${OUT_FILE}. ` +
      `packages/web/src/version.ts must export it verbatim.`,
  );
}

await Bun.write(OUT_FILE, bundle.replaceAll(VERSION_PLACEHOLDER, version));

const clientBundles = new Bun.Glob("*.js").scan(CLIENT_DIR);
const clientFiles: string[] = [];

for await (const file of clientBundles) {
  clientFiles.push(`${CLIENT_DIR}/${file}`);
}

await $`zip -j -q ${OUT_DIR}/handler.zip ${OUT_FILE} ${clientFiles}`.quiet();

const { size } = await Bun.file(`${OUT_DIR}/handler.zip`).stat();
console.log(
  `Built ${OUT_DIR}/handler.zip as version ${version} (${(size / 1024).toFixed(1)} kB)`,
);
