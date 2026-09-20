import {
  AnalyzeSubject,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  ListPrinciples,
  SrpRule,
} from "@principled/core";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLambdaHandler } from "./lambda.ts";
import { createRequestHandler } from "./server.ts";
import { loadClientAssets } from "./client-assets.ts";

// Lambda entry point shim. All behaviour lives in createLambdaHandler and
// createRequestHandler, which is why this file is excluded from mutation
// testing in stryker.config.json.
//
// InMemoryEventStore does not survive a cold start (ADR-0015): the port is
// real, the durable adapter is not built yet, the same gap already accepted
// for InMemoryPrincipleCatalog and InMemoryRuleCatalog below.
//
// Client bundles ship beside the handler in the zip (build-lambda.ts) and
// are read once per cold start; absent without a client build, in which
// case the form renders with no script tag.
const bundleDir = fileURLToPath(new URL("./", import.meta.url));
const clientAssets = await loadClientAssets(
  async () => readdir(bundleDir),
  async (name) => readFile(join(bundleDir, name), "utf8"),
);
export const handler = createLambdaHandler(
  createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    analyzeSubject: new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()])),
    eventStore: new InMemoryEventStore(),
    clientAssets,
  }),
);
