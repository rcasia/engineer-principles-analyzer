#!/usr/bin/env bun
/**
 * Packs the CLI exactly as `npm publish` would, installs the tarball into a
 * throwaway directory with Node, and runs the installed binary.
 *
 * This is the gate that proves the published package works for someone who
 * does not have Bun, and that `files` ships what it should and nothing else.
 */
import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE_DIR = "packages/cli";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const { version } = await Bun.file(`${PACKAGE_DIR}/package.json`).json();

// --- what would be published -----------------------------------------------

const contents: Array<{ path: string }> = (
  await $`npm pack --dry-run --json --silent`.cwd(PACKAGE_DIR).json()
)[0].files;

const shipped = contents.map((f) => f.path).sort();
console.log(`Tarball contents: ${shipped.join(", ")}`);

const required = ["dist/cli.mjs", "package.json", "README.md"];
for (const file of required) {
  if (!shipped.includes(file)) fail(`tarball is missing ${file}`);
}

// Tests, configs and type declarations have no business in a CLI tarball.
const forbidden = shipped.filter(
  (f) =>
    f.endsWith(".test.ts") ||
    f.endsWith(".d.ts") ||
    f === "tsconfig.json" ||
    f.startsWith("src/"),
);
if (forbidden.length > 0) fail(`tarball ships unwanted files: ${forbidden}`);

// --- does it actually run, under Node, from a clean install? ---------------

// The workspace: protocol is not valid semver. npm does not rewrite it when
// packing from the package directory, so it would reach the registry as is.
const manifest = await Bun.file(`${PACKAGE_DIR}/package.json`).json();
for (const field of [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const) {
  for (const [name, range] of Object.entries(manifest[field] ?? {})) {
    if (String(range).startsWith("workspace:")) {
      fail(`${field}.${name} uses the workspace: protocol, which npm cannot publish`);
    }
  }
}

if (manifest.private === true) fail("package is marked private and cannot be published");

const tarball = (await $`npm pack --silent`.cwd(PACKAGE_DIR).text()).trim();
const tarballPath = join(process.cwd(), PACKAGE_DIR, tarball);
const sandbox = await mkdtemp(join(tmpdir(), "principled-"));

try {
  await $`npm install --silent --no-audit --no-fund ${tarballPath}`
    .cwd(sandbox)
    .quiet();

  const bin = join(sandbox, "node_modules", ".bin", "principled");

  const listed = await $`${bin}`.cwd(sandbox).text();
  if (listed.trim() !== "No principles are defined yet.") {
    fail(`unexpected default output: ${JSON.stringify(listed)}`);
  }

  const reported = (await $`${bin} --version`.cwd(sandbox).text()).trim();
  if (reported !== `principled ${version}`) {
    fail(`expected version "principled ${version}", got "${reported}"`);
  }

  const help = await $`${bin} --help`.cwd(sandbox).text();
  if (!help.includes("Usage:")) fail("help output is missing a usage section");

  // Unknown options must be a usage error, not a crash and not a success.
  const unknown = await $`${bin} --nope`.cwd(sandbox).nothrow().quiet();
  if (unknown.exitCode !== 2) {
    fail(`expected exit code 2 for an unknown option, got ${unknown.exitCode}`);
  }

  const installed = await $`npm ls --json --silent`.cwd(sandbox).json();
  const deps = Object.keys(installed.dependencies?.principled?.dependencies ?? {});
  if (deps.length > 0) fail(`published package pulled in dependencies: ${deps}`);

  console.log(
    `principled ${version} installs and runs under ${process.versions.node ? `Node ${(await $`node --version`.text()).trim()}` : "Node"} with no dependencies.`,
  );
} finally {
  await rm(sandbox, { recursive: true, force: true });
  await rm(tarballPath, { force: true });
}
