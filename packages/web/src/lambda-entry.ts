import {
  AnalyzeSubject,
  InMemoryEventStore,
  InMemoryPrincipleCatalog,
  InMemoryRuleCatalog,
  ListPrinciples,
} from "@principled/core";
import { createLambdaHandler } from "./lambda.ts";
import { createRequestHandler } from "./server.ts";

// Lambda entry point shim. All behaviour lives in createLambdaHandler and
// createRequestHandler, which is why this file is excluded from mutation
// testing in stryker.config.json.
//
// InMemoryEventStore does not survive a cold start (ADR-0015): the port is
// real, the durable adapter is not built yet, the same gap already accepted
// for InMemoryPrincipleCatalog and InMemoryRuleCatalog below.
export const handler = createLambdaHandler(
  createRequestHandler({
    listPrinciples: new ListPrinciples(new InMemoryPrincipleCatalog()),
    analyzeSubject: new AnalyzeSubject(new InMemoryRuleCatalog()),
    eventStore: new InMemoryEventStore(),
    // Set only behind CloudFront (ADR-0017). Absent locally and on LocalStack,
    // where the Function URL is deliberately open, so the check is skipped.
    originSecret: process.env.ORIGIN_VERIFY_SECRET,
  }),
);
