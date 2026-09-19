import { InMemoryPrincipleCatalog, ListPrinciples } from "@epa/core";
import { createLambdaHandler } from "./lambda.ts";
import { createRequestHandler } from "./server.ts";

// Lambda entry point shim. All behaviour lives in createLambdaHandler and
// createRequestHandler, which is why this file is excluded from mutation
// testing in stryker.config.json.
export const handler = createLambdaHandler(
  createRequestHandler(new ListPrinciples(new InMemoryPrincipleCatalog())),
);
