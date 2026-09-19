#!/usr/bin/env bun
import {
  AnalyzeSubject,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  ListPrinciples,
} from "@principled/core";
import { createRequestHandler } from "./server.ts";

// Executable shim only. All behaviour lives in createRequestHandler, which is
// why this file is excluded from mutation testing in stryker.config.json.
const server = Bun.serve({
  port: Number(Bun.env["PORT"] ?? 3000),
  fetch: createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    // Empty until #10-#14 register real SOLID rules here.
    analyzeSubject: new AnalyzeSubject(new InMemoryRuleCatalog()),
    eventStore: new InMemoryEventStore(),
  }),
});

console.log(`Listening on ${server.url}`);
