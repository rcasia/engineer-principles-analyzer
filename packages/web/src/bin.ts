#!/usr/bin/env bun
import {
  AnalyzeSubject,
  DipRule,
  HttpJevClient,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  JevLanguageDetector,
  IspRule,
  ListPrinciples,
  LspRule,
  OcpRule,
  SrpRule,
} from "@principled/core";
import { createRequestHandler } from "./server.ts";
import { loadClientAssets } from "./shared/client-assets.ts";

// Executable shim only. All behaviour lives in createRequestHandler, which is
// why this file is excluded from mutation testing in stryker.config.json.
const apiKey = Bun.env["TYPESAFE_API_KEY"];
if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error(
    "TYPESAFE_API_KEY must be set to run the web server: language detection asks Jev (ADR-0028).",
  );
}

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
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule(), new OcpRule(), new LspRule(), new IspRule(), new DipRule()]),
    ),
    languageDetector: new JevLanguageDetector(
      new HttpJevClient({ apiKey, fetchFn: globalThis.fetch }),
    ),
    eventStore: new InMemoryEventStore(),
    // Absent without a client build: the form renders with no script tag.
    clientAssets,
  }),
});

console.log(`Listening on ${server.url}`);
