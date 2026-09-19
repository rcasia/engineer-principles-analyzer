#!/usr/bin/env bun
/**
 * Prepares the web app for a release: writes the version and verifies both
 * Lambda bundles (the web origin and the edge signer) still build at that
 * commit.
 *
 * Mirrors scripts/release-cli.ts: the version is written directly rather
 * than through `npm version`, for the same reason - it would reify the
 * whole workspace tree and fail on Stryker's `catalog:` transitive range.
 * There is no publish step here, unlike the CLI: the web app is not
 * published to a registry, it is deployed by the `deploy` job that follows
 * this release train. See ADR-0008 and ADR-0016.
 */
import { $ } from "bun";

const PACKAGE_JSON = "packages/web/package.json";

const [version] = Bun.argv.slice(2);

if (version === undefined || version === "") {
  console.error("Usage: bun scripts/release-web.ts <version>");
  process.exit(2);
}

const manifest = await Bun.file(PACKAGE_JSON).json();
manifest.version = version;
await Bun.write(PACKAGE_JSON, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Set ${PACKAGE_JSON} version to ${version}`);

await $`bun run build:lambda`;
await $`bun run build:edge-signer`;
