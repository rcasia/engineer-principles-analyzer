import {
  edgeCredentials,
  handleOriginRequest,
  type CloudFrontEvent,
} from "./signer.ts";
import type { CloudFrontRequest, EdgeErrorResponse } from "./signer.ts";

// Lambda@Edge entry point shim. All behaviour lives in handleOriginRequest
// and edgeCredentials, which is why this file is excluded from mutation
// testing in stryker.config.json.
export const handler = (
  event: CloudFrontEvent,
): Promise<CloudFrontRequest | EdgeErrorResponse> =>
  Promise.resolve(
    handleOriginRequest(event, { credentials: edgeCredentials(), now: new Date() }),
  );

export {
  amzDateOf,
  canonicalQueryString,
  canonicalRequestOf,
  customHeaderValue,
  EDGE_FORBIDDEN_BODY,
  edgeCredentials,
  handleOriginRequest,
  LAMBDA_SERVICE,
  ORIGIN_HOST_HEADER,
  ORIGIN_REGION_HEADER,
  sha256Hex,
  signOriginRequest,
  signatureOf,
  sortedHeaderNames,
} from "./signer.ts";
export type {
  CloudFrontCustomOrigin,
  CloudFrontEvent,
  CloudFrontHeader,
  CloudFrontOrigin,
  CloudFrontRequest,
  EdgeCredentials,
  EdgeErrorResponse,
  EdgeHandlerDeps,
  SignOriginInput,
  SignatureInput,
  SignedOriginRequest,
  SigningParts,
} from "./signer.ts";
