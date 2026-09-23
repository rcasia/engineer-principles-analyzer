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
// ADR-0041: empty unless the custom domain is switched on.
const customDomain = await output("custom_domain");

// The custom domain is canonical when set: every page check runs against it,
// and the default distribution domain is checked separately for its 301.
const base = customDomain === "" ? url : `https://${customDomain}/`;

console.log(`Checking ${base} (cdn: ${cdnEnabled}, custom: ${customDomain || "off"})`);

// The first invocation starts the runtime container, so allow time for it.
const page = await fetch(base, { signal: AbortSignal.timeout(120_000) });
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

const missing = await fetch(new URL("/does-not-exist", base), {
  signal: AbortSignal.timeout(60_000),
});
if (missing.status !== 404) {
  fail(`expected 404 for an unknown path, got ${missing.status}`);
}

// #34's /analyze form POSTs to this origin. Through the CDN (real AWS) the
// Lambda@Edge signer must SigV4-sign the body (ADR-0019) - OAC alone cannot,
// which is exactly the 403 class this check guards against. A GET-only check
// would miss it entirely, and `apply` exiting zero cannot catch it.
// The language is fully auto-detected (ADR-0028: Jev judges the snippet,
// so it must be recognizable as TypeScript) and no `language` field is sent.
const analyzeForm = new FormData();
analyzeForm.set("sourceCode", "interface Foo { readonly name: string }");
const analyzePost = await fetch(new URL("/analyze", base), {
  method: "POST",
  body: analyzeForm,
  signal: AbortSignal.timeout(60_000),
});
if (analyzePost.status !== 200) {
  fail(
    `expected 200 for POST /analyze, got ${analyzePost.status} (is the edge signer failing to sign the body?)`,
  );
}

// ADR-0029: the playground form ships the live-highlight bundle when one
// was built; the findings page has no editor so it carries no script. The
// deploy is broken if the form references a script that 404s.
const playground = await fetch(new URL("/analyze", base), {
  signal: AbortSignal.timeout(60_000),
});
const playgroundBody = await playground.text();
const scriptMatch = playgroundBody.match(
  /<script type="module" src="([^"]+)"><\/script>/,
);

if (scriptMatch === null || scriptMatch[1] === undefined) {
  fail("GET /analyze rendered no live-highlight script tag");
}

const asset = await fetch(new URL(scriptMatch[1], base), {
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
  const cached = await fetch(base, { signal: AbortSignal.timeout(60_000) });
  const hitState = cached.headers.get("x-cache") ?? "unknown";

  if (!hitState.includes("Hit")) {
    console.warn(
      `WARNING: second request reported x-cache "${hitState}". Expected a cache hit; the edge may not have populated yet.`,
    );
  } else {
    console.log(`Edge cache confirmed: x-cache "${hitState}".`);
  }

  console.log("Origin correctly refuses direct access (403).");

  if (customDomain !== "") {
    // ADR-0041: once the alias exists, the default distribution domain must
    // not serve content - the canonical-host function 301s it to the custom
    // domain, preserving the path. redirect: manual, or fetch would follow
    // the 301 and the assertion would prove nothing.
    const legacy = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    const location = legacy.headers.get("location") ?? "";

    if (legacy.status !== 301) {
      fail(`default domain ${url} answered ${legacy.status}; it must 301 to the custom domain`);
    }
    if (location !== `https://${customDomain}/`) {
      fail(`default domain redirected to ${location}; expected https://${customDomain}/`);
    }

    console.log(`Default domain correctly redirects to https://${customDomain}/ (301).`);
  }
}

console.log("Deployed stack serves the page and 404s correctly.");
