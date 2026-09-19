import { describe, expect, it } from "bun:test";
import { createLambdaHandler, toRequest } from "./lambda.ts";
import type { FunctionUrlEvent } from "./lambda.ts";

function eventFor(overrides: Partial<FunctionUrlEvent> = {}): FunctionUrlEvent {
  return {
    rawPath: "/",
    rawQueryString: "",
    headers: { host: "epa.example.com" },
    isBase64Encoded: false,
    requestContext: { http: { method: "GET" } },
    ...overrides,
  };
}

describe("toRequest", () => {
  it("builds an https url from the host header and raw path", () => {
    expect(toRequest(eventFor({ rawPath: "/principles" })).url).toBe(
      "https://epa.example.com/principles",
    );
  });

  it("falls back to localhost when no host header is present", () => {
    expect(toRequest(eventFor({ headers: {} })).url).toBe("https://localhost/");
  });

  it("appends the query string only when there is one", () => {
    expect(toRequest(eventFor({ rawQueryString: "a=1&b=2" })).url).toBe(
      "https://epa.example.com/?a=1&b=2",
    );
    expect(toRequest(eventFor()).url).toBe("https://epa.example.com/");
  });

  it("carries the http method through", () => {
    const request = toRequest(
      eventFor({ requestContext: { http: { method: "DELETE" } } }),
    );

    expect(request.method).toBe("DELETE");
  });

  it("forwards headers and drops undefined ones", () => {
    const request = toRequest(
      eventFor({
        headers: { host: "epa.example.com", "x-kept": "yes", "x-dropped": undefined },
      }),
    );

    expect(request.headers.get("x-kept")).toBe("yes");
    expect(request.headers.get("x-dropped")).toBeNull();
  });

  it("forwards a plain text body on methods that allow one", async () => {
    const request = toRequest(
      eventFor({
        body: "hello",
        requestContext: { http: { method: "POST" } },
      }),
    );

    await expect(request.text()).resolves.toBe("hello");
  });

  it("decodes a base64 body", async () => {
    const request = toRequest(
      eventFor({
        body: Buffer.from("hello").toString("base64"),
        isBase64Encoded: true,
        requestContext: { http: { method: "POST" } },
      }),
    );

    await expect(request.text()).resolves.toBe("hello");
  });

  it.each(["GET", "HEAD"])("ignores a body sent with %s", (method) => {
    const request = toRequest(
      eventFor({ body: "hello", requestContext: { http: { method } } }),
    );

    expect(request.body).toBeNull();
  });

  it("sends no body when the event has none", () => {
    const request = toRequest(
      eventFor({ requestContext: { http: { method: "POST" } } }),
    );

    expect(request.body).toBeNull();
  });

  it("sends no body when the event has none but is flagged base64", () => {
    // Guards the decoding path: without the undefined check this would try to
    // base64 decode nothing and throw.
    const request = toRequest(
      eventFor({
        isBase64Encoded: true,
        requestContext: { http: { method: "POST" } },
      }),
    );

    expect(request.body).toBeNull();
  });
});

describe("createLambdaHandler", () => {
  it("maps the response status, headers and body back to Lambda", async () => {
    const handler = createLambdaHandler(async (request) =>
      Promise.resolve(
        new Response(`seen ${request.url}`, {
          status: 201,
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    expect(await handler(eventFor())).toEqual({
      statusCode: 201,
      headers: { "content-type": "text/plain" },
      body: "seen https://epa.example.com/",
    });
  });
});
