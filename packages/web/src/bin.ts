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
import { loadClientAssets } from "./client-assets.ts";

// Executable shim only. All behaviour lives in createRequestHandler, which is
// why this file is excluded from mutation testing in stryker.config.json.
const clientDir = new URL("../../../infra/build/client", import.meta.url);
const clientAssets = await loadClientAssets(
  async () => {
    const names: string[] = [];
    for await (const entry of new Bun.Glob("*.js").scan(clientDir.pathname)) {
      names.push(entry);
    }
    return names;
  },
  async (name) => Bun.file(new URL(name, `${clientDir.href}/`)).text(),
);

const server = Bun.serve({
  port: Number(Bun.env["PORT"] ?? 3000),
  fetch: createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    // Seeded with the real SOLID rules as they land (#10 SRP first).
    analyzeSubject: new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()])),
    eventStore: new InMemoryEventStore(),
    // Absent without a client build: the form renders with no script tag.
    clientAssets,
  }),
});

console.log(`Listening on ${server.url}`);
