#!/usr/bin/env bun
import {
  AnalyzeSubject,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  ListPrinciples,
  SrpRule,
} from "@principled/core";
import { createRequestHandler } from "./server.ts";

// Executable shim only. All behaviour lives in createRequestHandler, which is
// why this file is excluded from mutation testing in stryker.config.json.
const server = Bun.serve({
  port: Number(Bun.env["PORT"] ?? 3000),
  fetch: createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    // Seeded with the real SOLID rules as they land (#10 SRP first).
    analyzeSubject: new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()])),
    eventStore: new InMemoryEventStore(),
  }),
});

console.log(`Listening on ${server.url}`);
