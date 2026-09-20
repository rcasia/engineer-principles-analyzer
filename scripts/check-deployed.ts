#!/usr/bin/env bun
/**
 * Asks Terraform what it built and checks the deployed stack actually works.
 * Proves behaviour, not that `apply` exited zero.
 *
 * When CloudFront is in front (real AWS) this also verifies the two
 * properties the CDN exists for: that responses are cacheable, and that the
 * origin cannot be reached directly to bypass the cache (origin access
 * control, ADR-0009).
 */
import { $ } from "bun";

async function output(name: string): Promise<string> {
  return (await $`terraform -chdir=infra output -raw ${name}`.text()).trim();
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const url = await output("web_url");
const originUrl = await output("origin_url");
const cdnEnabled = (await output("cdn_enabled")) === "true";

console.log(`Checking ${url} (cdn: ${cdnEnabled})`);

// The first invocation starts the runtime container, so allow time for it.
const page = await fetch(url, { signal: AbortSignal.timeout(120_000) });
const body = await page.text();

if (page.status !== 200) fail(`expected 200 at /, got ${page.status}`);
if (page.headers.get("content-type") !== "text/html; charset=utf-8") {
  fail(`unexpected content-type: ${page.headers.get("content-type")}`);
}
if (!body.includes("<title>Principled</title>")) {
  fail("page did not contain the expected title");
}
if (!page.headers.get("cache-control")?.includes("max-age=60")) {
  fail(`page is not cacheable: ${page.headers.get("cache-control")}`);
}

const missing = await fetch(new URL("/does-not-exist", url), {
  signal: AbortSignal.timeout(60_000),
});
if (missing.status !== 404) {
  fail(`expected 404 for an unknown path, got ${missing.status}`);
}

// #34's /analyze form POSTs to this origin. Through the CDN (real AWS) the
// Lambda@Edge signer must SigV4-sign the body (ADR-0019) - OAC alone cannot,
// which is exactly the 403 class this check guards against. A GET-only check
// would miss it entirely, and `apply` exiting zero cannot catch it.
// The language is fully auto-detected (ADR-0026), so the snippet must carry
// a distinctive signal and no `language` field is sent.
const analyzeForm = new FormData();
analyzeForm.set("sourceCode", "interface Foo { readonly name: string }");
const analyzePost = await fetch(new URL("/analyze", url), {
  method: "POST",
  body: analyzeForm,
  signal: AbortSignal.timeout(60_000),
});
if (analyzePost.status !== 200) {
  fail(
    `expected 200 for POST /analyze, got ${analyzePost.status} (is the edge signer failing to sign the body?)`,
  );
}

// ADR-0027: the playground form ships the live-highlight bundle when one
// was built; the findings page has no editor so it carries no script. The
// deploy is broken if the form references a script that 404s.
const playground = await fetch(new URL("/analyze", url), {
  signal: AbortSignal.timeout(60_000),
});
const playgroundBody = await playground.text();
const scriptMatch = playgroundBody.match(
  /<script type="module" src="([^"]+)"><\/script>/,
);

if (scriptMatch === null || scriptMatch[1] === undefined) {
  fail("GET /analyze rendered no live-highlight script tag");
}

const asset = await fetch(new URL(scriptMatch[1], url), {
  signal: AbortSignal.timeout(60_000),
});

if (asset.status !== 200) {
  fail(`live-highlight bundle ${scriptMatch[1]} answered ${asset.status}`);
}

if (asset.headers.get("cache-control") !== "public, max-age=31536000, immutable") {
  fail(
    `live-highlight bundle is not immutable: ${asset.headers.get("cache-control")}`,
  );
}

if (cdnEnabled) {
  // The whole point of origin access control: the Function URL is signed for,
  // so an unsigned request straight to the origin must be refused. If this
  // passes, the cache and its cost protection can be bypassed.
  const direct = await fetch(originUrl, { signal: AbortSignal.timeout(60_000) });

  if (direct.status !== 403) {
    fail(
      `origin ${originUrl} answered ${direct.status} directly; it must return 403 behind OAC`,
    );
  }

  // Second request for the same path should be served by the edge.
  const cached = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const hitState = cached.headers.get("x-cache") ?? "unknown";

  if (!hitState.includes("Hit")) {
    console.warn(
      `WARNING: second request reported x-cache "${hitState}". Expected a cache hit; the edge may not have populated yet.`,
    );
  } else {
    console.log(`Edge cache confirmed: x-cache "${hitState}".`);
  }

  console.log("Origin correctly refuses direct access (403).");
}

console.log("Deployed stack serves the page and 404s correctly.");
