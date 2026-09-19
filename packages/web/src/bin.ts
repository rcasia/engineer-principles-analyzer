#!/usr/bin/env bun
import { InMemoryPrincipleCatalog, ListPrinciples } from "@principled/core";
import { createRequestHandler } from "./server.ts";

// Executable shim only. All behaviour lives in createRequestHandler, which is
// why this file is excluded from mutation testing in stryker.config.json.
const server = Bun.serve({
  port: Number(Bun.env["PORT"] ?? 3000),
  fetch: createRequestHandler(
    new ListPrinciples(new InMemoryPrincipleCatalog()),
  ),
});

console.log(`Listening on ${server.url}`);
