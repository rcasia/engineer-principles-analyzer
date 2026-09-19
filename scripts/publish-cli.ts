#!/usr/bin/env bun
/**
 * Publishes the CLI to npm, but only when NPM_PUBLISH is "true".
 *
 * The switch mirrors AWS_DEPLOY_ROLE_ARN for deployment (ADR-0007): the
 * whole path runs on every release and stops at the last step, so it cannot
 * rot before the day it is needed.
 */
import { $ } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE_DIR = "packages/cli";
const REGISTRY = "registry.npmjs.org";

const enabled = Bun.env["NPM_PUBLISH"] === "true";
const token = Bun.env["NPM_TOKEN"];

const { name, version } = await Bun.file(`${PACKAGE_DIR}/package.json`).json();

if (!enabled) {
  console.log(
    `NPM_PUBLISH is not "true", so ${name}@${version} was built and verified but not published.`,
  );
  process.exit(0);
}

if (token === undefined || token === "") {
  console.error(
    "NPM_PUBLISH is \"true\" but NPM_TOKEN is not set. Refusing to continue.",
  );
  process.exit(1);
}

// Written to a temporary file rather than the repository's .npmrc, so the
// token cannot be committed or left behind on a developer machine.
const configDir = await mkdtemp(join(tmpdir(), "principled-npm-"));
const npmrc = join(configDir, ".npmrc");

try {
  await writeFile(npmrc, `//${REGISTRY}/:_authToken=${token}\n`, {
    mode: 0o600,
  });

  await $`npm publish --userconfig ${npmrc}`.cwd(PACKAGE_DIR);

  console.log(`Published ${name}@${version} to npm.`);
} finally {
  await rm(configDir, { recursive: true, force: true });
}
