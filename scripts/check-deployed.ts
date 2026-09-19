#!/usr/bin/env bun
/**
 * Asks Terraform where the function ended up and checks it actually serves
 * the page. Proves the stack works, not merely that it applied cleanly.
 */
import { $ } from "bun";

const url = (await $`terraform -chdir=infra output -raw web_url`.text()).trim();
console.log(`Checking ${url}`);

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// The first invocation pulls and starts the runtime container, so allow time.
const page = await fetch(url, { signal: AbortSignal.timeout(120_000) });
const body = await page.text();

if (page.status !== 200) fail(`expected 200 at /, got ${page.status}`);
if (page.headers.get("content-type") !== "text/html; charset=utf-8") {
  fail(`unexpected content-type: ${page.headers.get("content-type")}`);
}
if (!body.includes("<title>Engineer Principles Analyzer</title>")) {
  fail("page did not contain the expected title");
}

const missing = await fetch(new URL("/does-not-exist", url), {
  signal: AbortSignal.timeout(60_000),
});
if (missing.status !== 404) {
  fail(`expected 404 for an unknown path, got ${missing.status}`);
}

console.log("Deployed function serves the page and 404s correctly.");
