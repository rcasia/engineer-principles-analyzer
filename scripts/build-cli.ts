#!/usr/bin/env bun
/**
 * Bundles the CLI into packages/cli/dist/cli.mjs for npm.
 *
 * @principled/core is bundled in rather than depended on, so the published package
 * has no runtime dependencies and npm never sees the workspace: protocol
 * (ADR-0008). Bun is the bundler, Node is the runtime: the shebang is
 * /usr/bin/env node so `npx principled` works for everyone, not only for
 * people who happen to have Bun installed.
 */
import { mkdir, rm } from "node:fs/promises";

const PACKAGE_DIR = "packages/cli";
const OUT_DIR = `${PACKAGE_DIR}/dist`;
const OUT_FILE = `${OUT_DIR}/cli.mjs`;
const ENTRY = `${PACKAGE_DIR}/src/bin.ts`;
const VERSION_PLACEHOLDER = "0.0.0-dev";

const { version } = await Bun.file(`${PACKAGE_DIR}/package.json`).json();

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUT_DIR,
  target: "node",
  format: "esm",
  minify: false, // A CLI people may read. Size is not the constraint here.
  naming: "cli.mjs",
  // No banner: Bun preserves the shebang from bin.ts, and a second one on
  // line 2 is a syntax error in Node rather than a harmless duplicate.
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error(`Failed to bundle ${ENTRY}`);
}

// Stamp the released version into the bundle. Fail loudly rather than ship a
// binary that lies about which version it is.
const bundle = await Bun.file(OUT_FILE).text();

if (!bundle.includes(VERSION_PLACEHOLDER)) {
  throw new Error(
    `Version placeholder "${VERSION_PLACEHOLDER}" not found in ${OUT_FILE}. ` +
      `packages/cli/src/version.ts must export it verbatim.`,
  );
}

await Bun.write(OUT_FILE, bundle.replaceAll(VERSION_PLACEHOLDER, version));

const { size } = await Bun.file(OUT_FILE).stat();
console.log(`Built ${OUT_FILE} as version ${version} (${(size / 1024).toFixed(1)} kB)`);
