#!/usr/bin/env bun
/**
 * Publishes the CLI to npm, but only when NPM_PUBLISH is "true".
 *
 * The switch mirrors AWS_DEPLOY_ROLE_ARN for deployment (ADR-0007): the
 * whole path runs on every release and stops at the last step, so it cannot
 * rot before the day it is needed.
 *
 * Authentication prefers npm trusted publishing over a long-lived token
 * (ADR-0010): the release workflow grants `id-token: write`, and npm >=
 * 11.5.1 exchanges that for a short-lived publish credential automatically
 * once a trusted publisher is registered for this repository and workflow
 * on npmjs.com. NPM_TOKEN is kept only as a fallback — npm tries OIDC first
 * and falls back to the token if OIDC is unavailable or unconfigured, which
 * is exactly the state before the first publish: a trusted publisher cannot
 * be registered for a package that does not exist on the registry yet. See
 * ADR-0010 for the one-time bootstrap and the token's retirement after it.
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
  // No fallback token configured: publishing relies entirely on OIDC trusted
  // publishing, which requires `id-token: write` in the workflow and a
  // trusted publisher already registered for this repository and workflow
  // file on npmjs.com.
  await $`npm publish`.cwd(PACKAGE_DIR);
  console.log(`Published ${name}@${version} to npm via OIDC trusted publishing.`);
  process.exit(0);
}

// Written to a temporary file rather than the repository's .npmrc, so the
// token cannot be committed or left behind on a developer machine. npm still
// attempts OIDC first; this file only takes effect if that exchange fails or
// no trusted publisher is configured yet.
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
