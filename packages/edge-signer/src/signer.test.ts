import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import {
  amzDateOf,
  canonicalQueryString,
  canonicalRequestOf,
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
  type CloudFrontEvent,
  type CloudFrontOrigin,
  type CloudFrontRequest,
  type EdgeCredentials,
} from "./signer.ts";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("sha256Hex", () => {
  it("hashes the classic abc vector", async () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes the empty input to the well-known empty digest", async () => {
    expect(sha256Hex(new Uint8Array())).toBe(EMPTY_SHA256);
    expect(EMPTY_SHA256).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("amzDateOf", () => {
  it("formats the only timestamp shape SigV4 accepts", async () => {
    expect(amzDateOf(new Date("2015-08-30T12:36:00.000Z"))).toBe("20150830T123600Z");
  });
});

describe("canonicalQueryString", () => {
  it("leaves an empty query string empty", async () => {
    expect(canonicalQueryString("")).toBe("");
  });

  it("sorts pairs by encoded name", async () => {
    expect(canonicalQueryString("b=2&a=1")).toBe("a=1&b=2");
  });

  it("encodes names and values", async () => {
    expect(canonicalQueryString("a b=c d")).toBe("a%20b=c%20d");
  });

  it("drops empty pairs and treats a valueless name as empty", async () => {
    expect(canonicalQueryString("a=1&&flag")).toBe("a=1&flag=");
  });

  it("keeps a valueless empty name with its separator", async () => {
    expect(canonicalQueryString("=v")).toBe("=v");
  });

  it("encodes separators inside values", async () => {
    expect(canonicalQueryString("a=b=c")).toBe("a=b%3Dc");
  });

  it("encodes the characters encodeURIComponent leaves alone but SigV4 does not", async () => {
    expect(canonicalQueryString("q=a!b'c(d)e*f~g")).toBe("q=a%21b%27c%28d%29e%2Af~g");
  });
});

describe("sortedHeaderNames", () => {
  it("returns signed-header names ascending regardless of insertion order", async () => {
    expect(
      sortedHeaderNames({ "x-amz-date": "d", host: "h", "x-amz-content-sha256": "p" }),
    ).toEqual(["host", "x-amz-content-sha256", "x-amz-date"]);
  });
});

describe("canonicalRequestOf", () => {
  // Vectors below are the official AWS SigV4 test suite (botocore
  // aws4_testsuite/get-vanilla.*), fetched 2026-09-19 - not recalled.
  const VANILLA_CANONICAL_REQUEST = [
    "GET",
    "/",
    "",
    "host:example.amazonaws.com\nx-amz-date:20150830T123600Z\n",
    "host;x-amz-date",
    EMPTY_SHA256,
  ].join("\n");

  it("reproduces the official AWS get-vanilla canonical request exactly", async () => {
    expect(
      canonicalRequestOf({
        method: "GET",
        uri: "/",
        querystring: "",
        signedHeaders: {
          host: "example.amazonaws.com",
          "x-amz-date": "20150830T123600Z",
        },
        payloadHash: EMPTY_SHA256,
      }),
    ).toBe(VANILLA_CANONICAL_REQUEST);
  });

  it("hashes that canonical request to the official string-to-sign hash", async () => {
    expect(sha256Hex(VANILLA_CANONICAL_REQUEST)).toBe(
      "bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63",
    );
  });

  it("sorts signed headers and trims their values", async () => {
    expect(
      canonicalRequestOf({
        method: "POST",
        uri: "/analyze",
        querystring: "",
        signedHeaders: {
          "x-amz-date": "20150830T123600Z  ",
          host: "example.amazonaws.com",
        },
        payloadHash: EMPTY_SHA256,
      }),
    ).toBe(
      `POST\n/analyze\n\n` +
        `host:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\n` +
        `host;x-amz-date\n${EMPTY_SHA256}`,
    );
  });

  it("encodes special path characters per SigV4, leaving tilde alone", async () => {
    const body = canonicalRequestOf({
      method: "GET",
      uri: "/a b/c~d/e'f",
      querystring: "",
      signedHeaders: { host: "example.amazonaws.com" },
      payloadHash: EMPTY_SHA256,
    });

    expect(body.split("\n")[1]).toBe("/a%20b/c~d/e%27f");
  });
});

describe("signatureOf", () => {
  it("reproduces the official AWS get-vanilla authorization exactly", async () => {
    const canonicalRequest = [
      "GET",
      "/",
      "",
      "host:example.amazonaws.com\nx-amz-date:20150830T123600Z\n",
      "host;x-amz-date",
      EMPTY_SHA256,
    ].join("\n");

    expect(
      signatureOf({
        canonicalRequest,
        amzDate: "20150830T123600Z",
        dateStamp: "20150830",
        region: "us-east-1",
        service: "service",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      }),
    ).toBe("5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  });
});

describe("signOriginRequest", () => {
  const credentials: EdgeCredentials = {
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  };
  const now = new Date("2024-01-15T12:34:56.000Z");

  it("signs a POST body, scoping the credential to the lambda service", async () => {
    const signed = signOriginRequest({
      method: "POST",
      uri: "/analyze",
      querystring: "",
      body: new TextEncoder().encode("class Foo {}"),
      originHost: "abc.lambda-url.eu-west-1.on.aws",
      region: "eu-west-1",
      credentials,
      now,
    });

    expect(signed.host).toBe("abc.lambda-url.eu-west-1.on.aws");
    expect(signed.amzDate).toBe("20240115T123456Z");
    expect(signed.payloadHash).toBe(sha256Hex("class Foo {}"));
    expect(signed.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20240115\/eu-west-1\/lambda\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(signed.sessionToken).toBeUndefined();
    expect(LAMBDA_SERVICE).toBe("lambda");
  });

  it("covers the session token in the signature when one is present", async () => {
    const signed = signOriginRequest({
      method: "GET",
      uri: "/",
      querystring: "",
      body: new Uint8Array(),
      originHost: "abc.lambda-url.eu-west-1.on.aws",
      region: "eu-west-1",
      credentials: { ...credentials, sessionToken: "token" },
      now,
    });

    expect(signed.sessionToken).toBe("token");
    expect(signed.payloadHash).toBe(EMPTY_SHA256);
    expect(signed.authorization).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token");
  });

  it("matches an independent WebCrypto recomputation, ruling out a shared implementation bug", async () => {
    const subtle = globalThis.crypto.subtle;
    const encode = (s: string): Uint8Array<ArrayBuffer> =>
      new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
    const hmac = async (
      key: Uint8Array<ArrayBuffer>,
      data: Uint8Array<ArrayBuffer>,
    ): Promise<Uint8Array<ArrayBuffer>> => {
      const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return new Uint8Array(await subtle.sign("HMAC", k, data));
    };
    const hex = (bytes: Uint8Array): string =>
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const body = encode("class Foo {}");
    const payloadHash = hex(new Uint8Array(await subtle.digest("SHA-256", body)));
    const canonicalRequest = [
      "POST",
      "/analyze",
      "",
      `host:abc.lambda-url.eu-west-1.on.aws\nx-amz-content-sha256:${payloadHash}\nx-amz-date:20240115T123456Z\n`,
      "host;x-amz-content-sha256;x-amz-date",
      payloadHash,
    ].join("\n");
    const scope = "20240115/eu-west-1/lambda/aws4_request";
    const stringToSign = encode(
      `AWS4-HMAC-SHA256\n20240115T123456Z\n${scope}\n${hex(new Uint8Array(await subtle.digest("SHA-256", encode(canonicalRequest))))}`,
    );
    const kDate = await hmac(encode("AWS4wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"), encode("20240115"));
    const kRegion = await hmac(kDate, encode("eu-west-1"));
    const kService = await hmac(kRegion, encode("lambda"));
    const kSigning = await hmac(kService, encode("aws4_request"));
    const expected = hex(await hmac(kSigning, stringToSign));

    const signed = signOriginRequest({
      method: "POST",
      uri: "/analyze",
      querystring: "",
      body,
      originHost: "abc.lambda-url.eu-west-1.on.aws",
      region: "eu-west-1",
      credentials,
      now,
    });

    expect(signed.authorization).toBe(
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/${scope}, ` +
        `SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${expected}`,
    );
  });
});

describe("edgeCredentials", () => {
  const KEY = "AWS_ACCESS_KEY_ID";
  const SECRET = "AWS_SECRET_ACCESS_KEY";
  const TOKEN = "AWS_SESSION_TOKEN";

  function saveEnv(): Record<string, string | undefined> {
    return { [KEY]: process.env[KEY], [SECRET]: process.env[SECRET], [TOKEN]: process.env[TOKEN] };
  }

  function restoreEnv(saved: Record<string, string | undefined>): void {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }

  it("returns undefined unless both key parts are present", async () => {
    const saved = saveEnv();
    try {
      delete process.env[KEY];
      delete process.env[SECRET];
      expect(edgeCredentials()).toBeUndefined();

      process.env[KEY] = "AKID";
      expect(edgeCredentials()).toBeUndefined();

      delete process.env[KEY];
      process.env[SECRET] = "secret";
      expect(edgeCredentials()).toBeUndefined();
    } finally {
      restoreEnv(saved);
    }
  });

  it("passes the session token through when present", async () => {
    const saved = saveEnv();
    try {
      process.env[KEY] = "AKID";
      process.env[SECRET] = "secret";
      process.env[TOKEN] = "token";
      expect(edgeCredentials()).toEqual({
        accessKeyId: "AKID",
        secretAccessKey: "secret",
        sessionToken: "token",
      });

      delete process.env[TOKEN];
      expect(edgeCredentials()).toEqual({
        accessKeyId: "AKID",
        secretAccessKey: "secret",
        sessionToken: undefined,
      });
    } finally {
      restoreEnv(saved);
    }
  });
});

describe("handleOriginRequest", () => {
  const credentials: EdgeCredentials = {
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  };
  const now = new Date("2024-01-15T12:34:56.000Z");
  const originHost = "abc.lambda-url.eu-west-1.on.aws";

  function originWith(headers: Record<string, string>): CloudFrontOrigin {
    const customHeaders: Record<string, { key: string; value: string }[]> = {};
    for (const [name, value] of Object.entries(headers)) {
      customHeaders[name] = [{ key: name, value }];
    }
    return { custom: { customHeaders } };
  }

  function validOrigin(): CloudFrontOrigin {
    return originWith({ [ORIGIN_HOST_HEADER]: originHost, [ORIGIN_REGION_HEADER]: "eu-west-1" });
  }

  function eventFor(
    viewerHeaders: Record<string, string>,
    body?: CloudFrontRequest["body"],
    origin: CloudFrontOrigin = validOrigin(),
  ): CloudFrontEvent {
    const cfHeaders: CloudFrontRequest["headers"] = {};
    for (const [name, value] of Object.entries(viewerHeaders)) {
      cfHeaders[name] = [{ key: name, value }];
    }

    return {
      Records: [
        {
          cf: {
            request: {
              method: body === undefined ? "GET" : "POST",
              uri: "/analyze",
              querystring: "",
              headers: cfHeaders,
              origin,
              body,
            },
          },
        },
      ],
    };
  }

  function signedHeadersOf(result: CloudFrontRequest | { status: string }): Record<string, string> {
    const request = result as CloudFrontRequest;
    return Object.fromEntries(
      Object.entries(request.headers).map(([name, values]) => [name, values[0]?.value ?? ""]),
    );
  }

  it("signs a GET from the origin custom headers and leaves viewer headers alone", async () => {
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net" }),
      { credentials, now },
    );

    const headers = signedHeadersOf(result);
    expect(headers["host"]).toBe(originHost);
    expect(headers["x-amz-content-sha256"]).toBe(EMPTY_SHA256);
    expect(headers["x-amz-date"]).toBe("20240115T123456Z");
    expect(headers["authorization"]).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(ORIGIN_HOST_HEADER in headers).toBe(false);
    expect(ORIGIN_REGION_HEADER in headers).toBe(false);
    expect(ORIGIN_HOST_HEADER).toBe("x-origin-host");
    expect(ORIGIN_REGION_HEADER).toBe("x-origin-region");
  });

  it("matches origin custom header names case-insensitively", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        undefined,
        originWith({ "X-Origin-Host": originHost, "X-Origin-Region": "eu-west-1" }),
      ),
      { credentials, now },
    );

    expect(signedHeadersOf(result)["host"]).toBe(originHost);
  });

  it("overwrites a viewer-supplied authorization header instead of trusting it", async () => {
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net", authorization: "hunter2" }),
      { credentials, now },
    );

    expect(signedHeadersOf(result)["authorization"]).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
  });

  it("signs a text-encoded POST body as its UTF-8 bytes", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        { encoding: "text", data: "class Foo {}", inputTruncated: false },
      ),
      { credentials, now },
    );

    expect(signedHeadersOf(result)["x-amz-content-sha256"]).toBe(
      createHash("sha256").update("class Foo {}", "utf8").digest("hex"),
    );
  });

  it("signs the decoded bytes of a base64 POST body", async () => {
    const raw = "class Foo {}";
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        { encoding: "base64", data: Buffer.from(raw, "utf8").toString("base64"), inputTruncated: false },
      ),
      { credentials, now },
    );

    expect(signedHeadersOf(result)["x-amz-content-sha256"]).toBe(
      createHash("sha256").update(raw, "utf8").digest("hex"),
    );
  });

  it("forwards the session token as a signed header when credentials carry one", async () => {
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net" }),
      { credentials: { ...credentials, sessionToken: "token" }, now },
    ) as CloudFrontRequest;

    expect(signedHeadersOf(result)["x-amz-security-token"]).toBe("token");
    expect(result.headers["x-amz-security-token"]).toEqual([
      { key: "X-Amz-Security-Token", value: "token" },
    ]);
  });

  it("drops a viewer-supplied session token when the signer has none to sign", async () => {
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net", "x-amz-security-token": "smuggled" }),
      { credentials, now },
    );

    expect("x-amz-security-token" in signedHeadersOf(result)).toBe(false);
  });

  it.each<Record<string, string>>([{}, { [ORIGIN_REGION_HEADER]: "eu-west-1" }, { [ORIGIN_HOST_HEADER]: "" }])(
    "refuses to forward unsigned when the origin host is missing or empty: %p",
    async (customHeaders) => {
      const result = handleOriginRequest(
        eventFor({ host: "d111.cloudfront.net" }, undefined, originWith(customHeaders)),
        { credentials, now },
      );

      expect(result).toEqual({
        status: "403",
        statusDescription: "Forbidden",
        headers: {
          "content-type": [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
          "cache-control": [{ key: "Cache-Control", value: "no-store" }],
        },
        body: "Forbidden",
      });
      expect(EDGE_FORBIDDEN_BODY).toBe("Forbidden");
    },
  );

  it("refuses when the origin itself is missing", async () => {
    const event = eventFor({ host: "d111.cloudfront.net" });
    const request = event.Records[0]?.cf.request as unknown as Record<string, unknown>;
    delete request["origin"];

    const result = handleOriginRequest(event, { credentials, now });

    expect((result as { status: string }).status).toBe("403");
  });

  it.each<CloudFrontOrigin>([{}, { custom: {} }])(
    "refuses when the origin carries no usable custom origin: %p",
    async (origin) => {
      const result = handleOriginRequest(
        eventFor({ host: "d111.cloudfront.net" }, undefined, origin),
        { credentials, now },
      );

      expect((result as { status: string }).status).toBe("403");
    },
  );

  it("refuses when the origin region is missing", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        undefined,
        originWith({ [ORIGIN_HOST_HEADER]: originHost }),
      ),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("refuses an empty origin host even when the region is fine", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        undefined,
        originWith({ [ORIGIN_HOST_HEADER]: "", [ORIGIN_REGION_HEADER]: "eu-west-1" }),
      ),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("refuses an empty origin region even when the host is fine", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        undefined,
        originWith({ [ORIGIN_HOST_HEADER]: originHost, [ORIGIN_REGION_HEADER]: "" }),
      ),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("forwards the exact wire format CloudFront expects, casing included", async () => {
    const result = handleOriginRequest(
      eventFor({
        host: "d111.cloudfront.net",
        [ORIGIN_HOST_HEADER]: originHost,
        [ORIGIN_REGION_HEADER]: "eu-west-1",
      }),
      { credentials, now },
    ) as CloudFrontRequest;

    expect(result.method).toBe("GET");
    expect(result.uri).toBe("/analyze");
    expect(result.headers["host"]).toEqual([{ key: "Host", value: originHost }]);
    expect(result.headers["x-amz-date"]).toEqual([{ key: "X-Amz-Date", value: "20240115T123456Z" }]);
    expect(result.headers["x-amz-content-sha256"]).toEqual([
      { key: "X-Amz-Content-Sha256", value: EMPTY_SHA256 },
    ]);
    expect(result.headers["authorization"]?.[0]?.key).toBe("Authorization");
  });

  it("refuses a truncated body it could not hash correctly", async () => {
    const result = handleOriginRequest(
      eventFor(
        { host: "d111.cloudfront.net" },
        { encoding: "text", data: "partial", inputTruncated: true },
      ),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("refuses when no credentials are available to sign with", async () => {
    const headers = { host: "d111.cloudfront.net" };

    expect(
      (handleOriginRequest(eventFor(headers), { credentials: undefined, now }) as { status: string }).status,
    ).toBe("403");
    expect(
      (
        handleOriginRequest(eventFor(headers), {
          credentials: { accessKeyId: "", secretAccessKey: "" },
          now,
        }) as { status: string }
      ).status,
    ).toBe("403");
  });

  it.each([
    { accessKeyId: "", secretAccessKey: "secret" },
    { accessKeyId: "AKID", secretAccessKey: "" },
  ])("refuses when exactly one key part is empty: %p", async (credentials) => {
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net" }),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("refuses when the origin host header is present but holds no values", async () => {
    const origin = originWith({ [ORIGIN_REGION_HEADER]: "eu-west-1" });
    const customHeaders = origin.custom?.customHeaders as Record<string, { key: string; value: string }[]>;
    customHeaders[ORIGIN_HOST_HEADER] = [];
    const result = handleOriginRequest(
      eventFor({ host: "d111.cloudfront.net" }, undefined, origin),
      { credentials, now },
    );

    expect((result as { status: string }).status).toBe("403");
  });

  it("refuses an event with no request at all", async () => {
    expect(handleOriginRequest({ Records: [] }, { credentials, now })).toEqual(
      expect.objectContaining({ status: "403", body: "Forbidden" }),
    );
  });
});
