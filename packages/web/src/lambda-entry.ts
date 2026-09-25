import {
  AnalyzeSubject,
  DipRule,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  IspRule,
  ListPrinciples,
  LspRule,
  OcpRule,
  SOLID_PRINCIPLES,
  SrpRule,
  WebMetrics,
} from "@principled/core";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLambdaHandler } from "./lambda.ts";
import { detectorFor } from "./language-detector.ts";
import { createRequestHandler } from "./server.ts";
import { loadClientAssets } from "./shared/client-assets.ts";
import { legalContactFromEnvironment } from "./legal/legal-page.ts";

// Lambda entry point shim. All behaviour lives in createLambdaHandler and
// createRequestHandler, which is why this file is excluded from mutation
// testing in stryker.config.json.
//
// InMemoryEventStore does not survive a cold start (ADR-0015): the port is
// real, the durable adapter is not built yet. The principle and rule
// catalogs below are static seeds rebuilt on every cold start, so they
// need no durability.
//
// Language detection asks Jev (ADR-0028) and the key reaches the function
// through the `typesafe_api_key` infra variable (ADR-0037). When it is
// absent the cold start must still succeed: detectorFor reports every
// submission as undetectable, so pages serve and submissions get the 400
// guidance, instead of every route 502ing because detection cannot run.

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
    listPrinciples: new ListPrinciples(
      new InMemoryPrincipleCatalog(SOLID_PRINCIPLES),
    ),
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule(), new OcpRule(), new LspRule(), new IspRule(), new DipRule()]),
    ),
    languageDetector: detectorFor(process.env["TYPESAFE_API_KEY"]),
    eventStore: new InMemoryEventStore(),
    clientAssets,
    legalContact: legalContactFromEnvironment(process.env),
    recordMetric: (event) => {
      metrics = metrics.record(event);
    },
    readMetrics: () => metrics.summarize(),
  }),
);
