#!/usr/bin/env bun
/**
 * Prepares the CLI for a release: writes the version, builds the bundle and
 * verifies the tarball.
 *
 * This replaces @semantic-release/npm, which shells out to `npm version`.
 * That command reifies the whole workspace tree and fails with
 * EUNSUPPORTEDPROTOCOL on any dependency using a non-npm range — Stryker's
 * transitive deps ship `catalog:`, which we do not control. Writing the
 * version ourselves avoids npm entirely until the publish step. See ADR-0008.
 */
import { $ } from "bun";

const PACKAGE_JSON = "packages/cli/package.json";

const [version] = Bun.argv.slice(2);

if (version === undefined || version === "") {
  console.error("Usage: bun scripts/release-cli.ts <version>");
  process.exit(2);
}

const manifest = await Bun.file(PACKAGE_JSON).json();
manifest.version = version;
await Bun.write(PACKAGE_JSON, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Set ${PACKAGE_JSON} version to ${version}`);

await $`bun scripts/build-cli.ts`;
await $`bun scripts/check-cli-package.ts`;
