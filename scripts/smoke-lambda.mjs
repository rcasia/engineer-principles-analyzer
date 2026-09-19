#!/usr/bin/env node
/**
 * Invokes the built Lambda bundle the way AWS would, under Node rather than
 * Bun. Production runs Node while development runs Bun (ADR-0005); this keeps
 * that gap visible instead of discovering it on deploy.
 */
import assert from "node:assert/strict";

const { handler } = await import("../infra/build/handler.mjs");

function event(path, method = "GET") {
  return {
    rawPath: path,
    rawQueryString: "",
    headers: { host: "smoke.test" },
    isBase64Encoded: false,
    requestContext: { http: { method } },
  };
}

const page = await handler(event("/"));
assert.equal(page.statusCode, 200, "root should return 200");
assert.equal(page.headers["content-type"], "text/html; charset=utf-8");
assert.ok(page.body.startsWith("<!doctype html>"), "should return a document");
assert.ok(
  page.body.includes("<title>Principled</title>"),
  "should render the page title",
);
assert.ok(page.body.includes('<html lang="en">'), "should declare a language");

const missing = await handler(event("/does-not-exist"));
assert.equal(missing.statusCode, 404, "unknown paths should return 404");
assert.equal(missing.body, "Not found");

console.log("Lambda bundle smoke test passed on Node " + process.version);
