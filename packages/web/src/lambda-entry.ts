import {
  AnalyzeSubject,
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
  WebMetrics,
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
// Language detection asks Jev (ADR-0028): TYPESAFE_API_KEY must reach the
// function as an environment variable (infra follow-up), or the cold start
// fails fast instead of 400ing every submission.
const apiKey = process.env["TYPESAFE_API_KEY"];
if (apiKey === undefined || apiKey.trim().length === 0) {
  throw new Error(
    "TYPESAFE_API_KEY must be set: language detection asks Jev (ADR-0028).",
  );
}

// Client bundles ship beside the handler in the zip (build-lambda.ts) and
// are read once per cold start; absent without a client build, in which
// case the form renders with no script tag.
const bundleDir = fileURLToPath(new URL("./", import.meta.url));
const clientAssets = await loadClientAssets(
  async () => readdir(bundleDir),
  async (name) => readFile(join(bundleDir, name), "utf8"),
);
// Privacy-safe product metrics (#31): an in-memory fold over minimized
// metric events, served at GET /metrics. Like InMemoryEventStore above it
// does not survive a cold start — the port (recordMetric/readMetrics) is
// real, the durable adapter is not built yet.
let metrics = WebMetrics.empty();
export const handler = createLambdaHandler(
  createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule(), new OcpRule(), new LspRule(), new IspRule()]),
    ),
    languageDetector: new JevLanguageDetector(
      new HttpJevClient({ apiKey, fetchFn: globalThis.fetch }),
    ),
    eventStore: new InMemoryEventStore(),
    clientAssets,
    recordMetric: (event) => {
      metrics = metrics.record(event);
    },
    readMetrics: () => metrics.summarize(),
  }),
);
