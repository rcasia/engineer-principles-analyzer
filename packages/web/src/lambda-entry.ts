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
import { SSMClient } from "@aws-sdk/client-ssm";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiKeyFor, SsmParameterStore } from "./api-key-store.ts";
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
// from SSM Parameter Store at cold start (ADR-0045): Terraform wires only
// the parameter *name* (`TYPESAFE_API_KEY_SSM_PARAMETER`), the value itself
// never crosses the deploy pipeline. When it is absent or unreadable the
// cold start must still succeed: detectorFor reports every submission as
// undetectable, so pages serve and submissions run as `"unknown"`
// (ADR-0040, ADR-0044), instead of every route 502ing because detection
// cannot run.

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
// Awaited before the handler exists: the SSM read happens once per cold
// start (the module-scoped detector below is reused across warm
// invocations), and apiKeyFor degrades any failure to keyless rather than
// throwing, so this await cannot fail the cold start.
const apiKey = await apiKeyFor(
  {
    directApiKey: process.env["TYPESAFE_API_KEY"],
    ssmParameterName: process.env["TYPESAFE_API_KEY_SSM_PARAMETER"],
  },
  new SsmParameterStore(new SSMClient({})),
);
export const handler = createLambdaHandler(
  createRequestHandler({
    listPrinciples: new ListPrinciples(
      new InMemoryPrincipleCatalog(SOLID_PRINCIPLES),
    ),
    analyzeSubject: new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule(), new OcpRule(), new LspRule(), new IspRule(), new DipRule()]),
    ),
    languageDetector: detectorFor(apiKey),
    eventStore: new InMemoryEventStore(),
    clientAssets,
    legalContact: legalContactFromEnvironment(process.env),
    recordMetric: (event) => {
      metrics = metrics.record(event);
    },
    readMetrics: () => metrics.summarize(),
  }),
);
