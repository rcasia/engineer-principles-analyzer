/**
 * Origin-request signer for CloudFront -> Lambda Function URL (ADR-0019).
 *
 * CloudFront origin access control signs SigV4 headers but never the
 * `x-amz-content-sha256` payload hash, so an `AWS_IAM` Function URL rejects
 * every POST with a signature mismatch - and this account's Organization
 * blocks the `AuthType NONE` alternative outright (ADR-0018). This function
 * runs as a Lambda@Edge origin-request trigger and signs the *whole*
 * request, body included, with its own IAM credentials, which the Function
 * URL's resource path authorizes.
 *
 * Pure `node:crypto`, no SDK, no environment variables (Lambda@Edge forbids
 * them): the origin's own host and region arrive as origin custom headers
 * that Terraform sets, read from `request.origin.custom.customHeaders` -
 * the only place they appear (origin custom headers are NOT merged into
 * `request.headers` at the origin-request trigger). The function fails
 * closed with a 403 edge response whenever anything needed for a valid
 * signature is missing.
 */

import { createHash, createHmac } from "node:crypto";

/** SigV4 service name for Lambda Function URL origins. */
export const LAMBDA_SERVICE = "lambda";

/**
 * Origin custom header carrying the origin's own host. Set in Terraform to
 * the Function URL's host; read here because Lambda@Edge forbids environment
 * variables, so a header is the only channel for deploy-time configuration.
 */
export const ORIGIN_HOST_HEADER = "x-origin-host";

/**
 * Origin custom header carrying the origin's AWS region. Same story as the
 * host above: no environment variables on Lambda@Edge, so deploy-time values
 * travel as headers and the bundle stays identical across environments.
 */
export const ORIGIN_REGION_HEADER = "x-origin-region";

export const EDGE_FORBIDDEN_BODY = "Forbidden";

/** The IAM credentials the edge runtime itself provides. */
export interface EdgeCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string | undefined;
}

export interface SigningParts {
  readonly method: string;
  readonly uri: string;
  readonly querystring: string;
  /** Lowercase header names to exact values: the SigV4 SignedHeaders set. */
  readonly signedHeaders: Readonly<Record<string, string>>;
  readonly payloadHash: string;
}

export interface SignatureInput {
  readonly canonicalRequest: string;
  readonly amzDate: string;
  readonly dateStamp: string;
  readonly region: string;
  readonly service: string;
  readonly secretAccessKey: string;
}

export interface SignOriginInput {
  readonly method: string;
  readonly uri: string;
  readonly querystring: string;
  readonly body: Uint8Array;
  readonly originHost: string;
  readonly region: string;
  readonly credentials: EdgeCredentials;
  readonly now: Date;
}

export interface SignedOriginRequest {
  readonly host: string;
  readonly authorization: string;
  readonly amzDate: string;
  readonly payloadHash: string;
  readonly sessionToken?: string | undefined;
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacBytes(key: string | Uint8Array, data: string): Uint8Array {
  return createHmac("sha256", key).update(data).digest();
}

function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Uint8Array {
  return hmacBytes(
    hmacBytes(
      hmacBytes(hmacBytes(`AWS4${secretAccessKey}`, dateStamp), region),
      service,
    ),
    "aws4_request",
  );
}

/** `YYYYMMDDTHHMMSSZ`, the only timestamp format SigV4 accepts. */
export function amzDateOf(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * SigV4's unreserved set is smaller than encodeURIComponent's: the latter
 * leaves `!'()*` unescaped, so they are encoded explicitly. `~` is unreserved
 * in both and passes through untouched.
 */
function sigV4Encode(value: string): string {
  // Every member of this class is U+0021..U+002A, so toString(16) is always
  // exactly two digits - no padding branch to test.
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => sigV4Encode(segment))
    .join("/");
}

/** Sorts and encodes query pairs exactly as SigV4 requires. */
export function canonicalQueryString(querystring: string): string {
  return querystring
    .split("&")
    .filter((pair) => pair !== "")
    .map((pair): [string, string] => {
      const separator = pair.indexOf("=");
      return separator < 0
        ? [pair, ""]
        : [pair.slice(0, separator), pair.slice(separator + 1)];
    })
    .map(([name, value]) => `${sigV4Encode(name)}=${sigV4Encode(value)}`)
    .sort()
    .join("&");
}

/** Lowercase signed-header names in ascending order. */
export function sortedHeaderNames(headers: Readonly<Record<string, string>>): string[] {
  return Object.keys(headers).sort();
}

export function canonicalRequestOf(parts: SigningParts): string {
  const names = sortedHeaderNames(parts.signedHeaders);
  const canonicalHeaders = names
    .map((name) => `${name}:${(parts.signedHeaders[name] as string).trim()}\n`)
    .join("");

  return [
    parts.method,
    encodePath(parts.uri),
    canonicalQueryString(parts.querystring),
    canonicalHeaders,
    names.join(";"),
    parts.payloadHash,
  ].join("\n");
}

export function signatureOf(input: SignatureInput): string {
  const scope = `${input.dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    scope,
    sha256Hex(input.canonicalRequest),
  ].join("\n");

  return createHmac(
    "sha256",
    signingKey(input.secretAccessKey, input.dateStamp, input.region, input.service),
  )
    .update(stringToSign)
    .digest("hex");
}

export function signOriginRequest(input: SignOriginInput): SignedOriginRequest {
  const amzDate = amzDateOf(input.now);
  const payloadHash = sha256Hex(input.body);

  const signedHeaders: Record<string, string> = {
    host: input.originHost,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (input.credentials.sessionToken !== undefined) {
    signedHeaders["x-amz-security-token"] = input.credentials.sessionToken;
  }

  const signature = signatureOf({
    canonicalRequest: canonicalRequestOf({
      method: input.method,
      uri: input.uri,
      querystring: input.querystring,
      signedHeaders,
      payloadHash,
    }),
    amzDate,
    dateStamp: amzDate.slice(0, 8),
    region: input.region,
    service: LAMBDA_SERVICE,
    secretAccessKey: input.credentials.secretAccessKey,
  });

  const signedNames = sortedHeaderNames(signedHeaders).join(";");

  return {
    host: input.originHost,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/` +
      `${amzDate.slice(0, 8)}/${input.region}/${LAMBDA_SERVICE}/aws4_request, ` +
      `SignedHeaders=${signedNames}, Signature=${signature}`,
    amzDate,
    payloadHash,
    sessionToken: input.credentials.sessionToken,
  };
}

// ---------------------------------------------------------------------------
// CloudFront origin-request handling.
// ---------------------------------------------------------------------------

export interface CloudFrontHeader {
  readonly key: string;
  readonly value: string;
}

export interface CloudFrontCustomOrigin {
  readonly customHeaders?: Readonly<Record<string, ReadonlyArray<CloudFrontHeader>>> | undefined;
}

export interface CloudFrontOrigin {
  readonly custom?: CloudFrontCustomOrigin | undefined;
}

export interface CloudFrontRequest {
  readonly method: string;
  readonly uri: string;
  readonly querystring: string;
  readonly headers: Record<string, CloudFrontHeader[]>;
  readonly origin?: CloudFrontOrigin | undefined;
  readonly body?:
    | {
        readonly encoding: "base64" | "text";
        readonly data: string;
        readonly inputTruncated: boolean;
      }
    | undefined;
}

export interface CloudFrontEvent {
  readonly Records: ReadonlyArray<{ readonly cf: { readonly request: CloudFrontRequest } }>;
}

export interface EdgeErrorResponse {
  readonly status: string;
  readonly statusDescription: string;
  readonly headers: Record<string, CloudFrontHeader[]>;
  readonly body: string;
}

export interface EdgeHandlerDeps {
  /**
   * Credentials to sign with, or undefined when the runtime provides none.
   * The handler fails closed on undefined - it never forwards unsigned.
   */
  readonly credentials: EdgeCredentials | undefined;
  readonly now: Date;
}

/**
 * Reads the IAM credentials the edge runtime provides. Returns undefined
 * unless both key parts are present; the caller fails closed on undefined.
 * Exported (rather than buried in the handler) so the fail-closed matrix is
 * unit-testable without fabricating whole CloudFront events.
 */
export function edgeCredentials(): EdgeCredentials | undefined {
  const accessKeyId = process.env["AWS_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["AWS_SECRET_ACCESS_KEY"];
  if (accessKeyId === undefined || secretAccessKey === undefined) {
    return undefined;
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env["AWS_SESSION_TOKEN"],
  };
}

/**
 * First value of an origin custom header, matched case-insensitively, or
 * undefined when absent or empty.
 */
export function customHeaderValue(
  customHeaders: Readonly<Record<string, ReadonlyArray<CloudFrontHeader>>> | undefined,
  name: string,
): string | undefined {
  if (customHeaders === undefined) {
    return undefined;
  }

  const wanted = name.toLowerCase();
  for (const [key, values] of Object.entries(customHeaders)) {
    if (key.toLowerCase() === wanted) {
      const first = values[0];
      if (first === undefined) {
        return undefined;
      }
      return first.value;
    }
  }

  return undefined;
}

function decodeBody(body: NonNullable<CloudFrontRequest["body"]>): Uint8Array {
  if (body.encoding === "base64") {
    const binary = atob(body.data);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  return new TextEncoder().encode(body.data);
}

function forbidden(): EdgeErrorResponse {
  return {
    status: "403",
    statusDescription: "Forbidden",
    headers: {
      "content-type": [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      "cache-control": [{ key: "Cache-Control", value: "no-store" }],
    },
    body: EDGE_FORBIDDEN_BODY,
  };
}

function setHeader(request: CloudFrontRequest, name: string, key: string, value: string): void {
  request.headers[name] = [{ key, value }];
}

/**
 * Signs an origin request and returns it for forwarding, or a 403 edge
 * response when no valid signature can be produced. Failing closed here -
 * rather than forwarding unsigned - is what keeps a misconfigured
 * distribution from silently exposing the origin.
 */
export function handleOriginRequest(
  event: CloudFrontEvent,
  deps: EdgeHandlerDeps,
): CloudFrontRequest | EdgeErrorResponse {
  const record = event.Records[0];
  if (record === undefined) {
    return forbidden();
  }
  const request = record.cf.request;

  // Deploy-time values live in origin.custom.customHeaders - NOT in
  // request.headers, which never carries origin custom headers at the
  // origin-request trigger. Without the origin's own host there is nothing
  // correct to sign for.
  const origin = request.origin;
  if (origin === undefined || origin.custom === undefined) {
    return forbidden();
  }
  const originHost = customHeaderValue(origin.custom.customHeaders, ORIGIN_HOST_HEADER);
  if (originHost === undefined || originHost === "") {
    return forbidden();
  }
  const originRegion = customHeaderValue(origin.custom.customHeaders, ORIGIN_REGION_HEADER);
  if (originRegion === undefined || originRegion === "") {
    return forbidden();
  }

  let body: Uint8Array = new Uint8Array();
  if (request.body !== undefined) {
    // A truncated body cannot be hashed correctly, so it cannot be signed.
    if (request.body.inputTruncated) {
      return forbidden();
    }
    body = decodeBody(request.body);
  }

  const credentials = deps.credentials;
  if (
    credentials === undefined ||
    credentials.accessKeyId === "" ||
    credentials.secretAccessKey === ""
  ) {
    return forbidden();
  }

  const signed = signOriginRequest({
    method: request.method,
    uri: request.uri,
    querystring: request.querystring,
    body,
    originHost,
    region: originRegion,
    credentials,
    now: deps.now,
  });

  setHeader(request, "host", "Host", signed.host);
  setHeader(request, "authorization", "Authorization", signed.authorization);
  setHeader(request, "x-amz-date", "X-Amz-Date", signed.amzDate);
  setHeader(request, "x-amz-content-sha256", "X-Amz-Content-Sha256", signed.payloadHash);
  if (signed.sessionToken !== undefined) {
    setHeader(request, "x-amz-security-token", "X-Amz-Security-Token", signed.sessionToken);
  } else {
    delete request.headers["x-amz-security-token"];
  }
  // The scaffolding headers are origin custom headers, not request headers:
  // CloudFront adds them to the origin request itself, where they are
  // harmless (static config values the origin ignores), and a
  // viewer-supplied header of the same name is overwritten by CloudFront
  // before forwarding - so there is nothing to strip and nothing to spoof.
  return request;
}
