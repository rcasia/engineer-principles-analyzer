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

  // Local analysis must work from the tarball exactly as from source: a
  // violating fixture exits 1 with human findings, a clean one exits 0,
  // and the machine-readable shapes carry schema version 1.
  const violating = [
    "class UserManager {",
    "  save(user) {}",
    "  load(id) {}",
    "  send(email) {}",
    "  notify(user) {}",
    "  render(user) {}",
    "  display(user) {}",
    "}",
    "",
  ].join("\n");
  const clean = [
    "class Calculator {",
    "  add(a, b) {}",
    "  subtract(a, b) {}",
    "  multiply(a, b) {}",
    "}",
    "",
  ].join("\n");
  await Bun.write(join(sandbox, "violating.ts"), violating);
  await Bun.write(join(sandbox, "clean.ts"), clean);

  const found = await $`${bin} analyze violating.ts`.cwd(sandbox).nothrow().quiet();
  if (found.exitCode !== 1) {
    fail(`expected exit code 1 for a violation, got ${found.exitCode}`);
  }
  const foundText = await found.text();
  if (!foundText.includes("violation solid.srp")) {
    fail(`human output is missing the violation: ${JSON.stringify(foundText)}`);
  }

  const none = await $`${bin} analyze clean.ts`.cwd(sandbox).nothrow().quiet();
  if (none.exitCode !== 0) {
    fail(`expected exit code 0 for a clean file, got ${none.exitCode}`);
  }

  const jsonRun = await $`${bin} analyze violating.ts --format json`.cwd(sandbox).nothrow().quiet();
  if (jsonRun.exitCode !== 1) {
    fail(`expected exit code 1 for JSON with a violation, got ${jsonRun.exitCode}`);
  }
  const json = JSON.parse(await jsonRun.text());
  if (json.schemaVersion !== "1") {
    fail(`expected JSON schemaVersion "1", got ${JSON.stringify(json.schemaVersion)}`);
  }
  if (json.status !== "completed" || json.ruleCount !== 1) {
    fail(`unexpected JSON envelope: ${JSON.stringify(json).slice(0, 200)}`);
  }

  const sarifRun = await $`${bin} analyze violating.ts --format sarif`.cwd(sandbox).nothrow().quiet();
  if (sarifRun.exitCode !== 1) {
    fail(`expected exit code 1 for SARIF with a violation, got ${sarifRun.exitCode}`);
  }
  const sarif = JSON.parse(await sarifRun.text());
  if (sarif.version !== "2.1.0") {
    fail(`expected SARIF version "2.1.0", got ${JSON.stringify(sarif.version)}`);
  }
  if (sarif.runs?.[0]?.properties?.["principled/schemaVersion"] !== "1") {
    fail("SARIF run is missing principled/schemaVersion 1");
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
