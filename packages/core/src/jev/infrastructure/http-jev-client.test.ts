import { describe, expect, test } from "bun:test";
import {
  JevTransportError,
  type NoulQuestion,
} from "../application/jev-client.port.ts";
import { InvalidJevResponseError } from "../domain/jev-response.ts";
import {
  HttpJevClient,
  type FetchFn,
  type FetchRequestInit,
  type FetchResponseLike,
} from "./http-jev-client.ts";

const QUESTION: NoulQuestion = {
  instructions: "Does this violate SRP?",
  criteria: { true: "Several jobs.", false: "One job." },
};

const STATE = { sourceCode: "class Foo {}", language: "typescript" };

interface CapturedCall {
  readonly url: string;
  readonly init: FetchRequestInit;
}

function stubFetch(
  respond: (call: CapturedCall) => FetchResponseLike | Promise<FetchResponseLike>,
): { readonly fetchFn: FetchFn; readonly calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetchFn: FetchFn = (url, init) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  return { fetchFn, calls };
}

function okResponse(body: unknown): FetchResponseLike {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

describe("HttpJevClient", () => {
  test("sends the exact SystemOne request and returns the parsed judgment", async () => {
    const { fetchFn, calls } = stubFetch(() =>
      okResponse({
        model: "jev-1.13.0",
        answers: { noul: { type: "noul", noul: 0.92 } },
        usage: { input_tokens: 312, output_tokens: 48 },
      }),
    );
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const judgment = await client.evaluateNoul({
      state: STATE,
      question: QUESTION,
    });

    expect(judgment).toEqual({ value: 0.92, model: "jev-1.13.0" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({
        state: STATE,
        model: "jev-latest",
        questions: {
          noul: {
            type: "noul",
            instructions: "Does this violate SRP?",
            criteria: { true: "Several jobs.", false: "One job." },
          },
        },
      }),
    );
  });

  test("honours a custom endpoint and model", async () => {
    const { fetchFn, calls } = stubFetch(() =>
      okResponse({
        model: "custom-model",
        answers: { noul: { type: "noul", noul: 0.1 } },
      }),
    );
    const client = new HttpJevClient({
      apiKey: "test-key",
      fetchFn,
      endpoint: "https://example.test/systemone",
      model: "custom-model",
    });

    const judgment = await client.evaluateNoul({
      state: STATE,
      question: QUESTION,
    });

    expect(judgment).toEqual({ value: 0.1, model: "custom-model" });
    expect(calls[0]?.url).toBe("https://example.test/systemone");
    expect(JSON.parse(calls[0]?.init.body ?? "{}").model).toBe("custom-model");
  });

  test("wraps a network failure without leaking state or key", async () => {
    const fetchFn: FetchFn = () =>
      Promise.reject(new Error("connection reset"));
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const error = await client
      .evaluateNoul({ state: STATE, question: QUESTION })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JevTransportError);
    expect((error as Error).message).toBe(
      "Jev request failed: connection reset",
    );
    expect((error as Error).message).not.toContain("test-key");
    expect((error as Error).message).not.toContain("class Foo {}");
  });

  test("stringifies a non-Error rejection", async () => {
    const fetchFn: FetchFn = () => Promise.reject("socket hung up");
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const error = await client
      .evaluateNoul({ state: STATE, question: QUESTION })
      .catch((thrown: unknown) => thrown);

    expect((error as Error).message).toBe("Jev request failed: socket hung up");
  });

  test("reports the status code, not the body, for error responses", async () => {
    const { fetchFn } = stubFetch(() => ({
      ok: false,
      status: 429,
      json: async () => ({ detail: "rate limited" }),
    }));
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const error = await client
      .evaluateNoul({ state: STATE, question: QUESTION })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JevTransportError);
    expect((error as Error).message).toBe(
      "Jev request failed with status 429.",
    );
  });

  test("fails loudly on an unreadable response body", async () => {
    const { fetchFn } = stubFetch(() => ({
      ok: true,
      status: 200,
      json: async (): Promise<unknown> => {
        throw new Error("unexpected token");
      },
    }));
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const error = await client
      .evaluateNoul({ state: STATE, question: QUESTION })
      .catch((thrown: unknown) => thrown);

    expect((error as Error).message).toBe(
      "Jev returned a response that could not be parsed.",
    );
  });

  test("propagates an invalid wire shape as InvalidJevResponseError", async () => {
    const { fetchFn } = stubFetch(() =>
      okResponse({ model: "jev-1.13.0", answers: {} }),
    );
    const client = new HttpJevClient({ apiKey: "test-key", fetchFn });

    const error = await client
      .evaluateNoul({ state: STATE, question: QUESTION })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(InvalidJevResponseError);
    expect((error as Error).message).toBe(
      'Jev response has no answer for question "noul".',
    );
  });

  test("rejects an empty apiKey at construction", () => {
    const { fetchFn } = stubFetch(() => okResponse({}));

    expect(() => new HttpJevClient({ apiKey: "  ", fetchFn })).toThrow(
      "HttpJevClient requires a non-empty apiKey.",
    );
  });
});
