import { describe, expect, it } from "bun:test";
import { GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  apiKeyFor,
  SsmParameterStore,
  type SsmSendFn,
} from "./api-key-store.ts";

// Fixture credentials, never real ones: kept in constants so no line pairs
// a key-like name with a string literal, which is what detect-secrets
// scans for (ADR-0027).
const LITERAL_KEY = "key-1";
const SSM_KEY = "key-2";
const PARAM_NAME = "/p/key";

function readerFor(
  value: string | undefined,
  calls: string[],
  error?: Error,
): { readonly readParameter: (name: string) => Promise<string | undefined> } {
  return {
    readParameter: (name: string) => {
      calls.push(name);

      if (error !== undefined) {
        return Promise.reject(error);
      }

      return Promise.resolve(value);
    },
  };
}

function sendFor(
  value: { readonly Parameter?: { readonly Value?: string } | undefined },
  seen: GetParameterCommand[],
): SsmSendFn {
  return (command) => {
    seen.push(command);
    return Promise.resolve(value);
  };
}

describe("SsmParameterStore", () => {
  it("reads and decrypts the named parameter", async () => {
    const seen: GetParameterCommand[] = [];
    const store = new SsmParameterStore({
      send: sendFor({ Parameter: { Value: LITERAL_KEY } }, seen),
    });

    await expect(store.readParameter(PARAM_NAME)).resolves.toBe(LITERAL_KEY);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(GetParameterCommand);
    expect(seen[0]?.input).toEqual({ Name: PARAM_NAME, WithDecryption: true });
  });

  it("resolves a blank value as absent", async () => {
    const seen: GetParameterCommand[] = [];
    const store = new SsmParameterStore({
      send: sendFor({ Parameter: { Value: "   " } }, seen),
    });

    await expect(store.readParameter(PARAM_NAME)).resolves.toBeUndefined();
  });

  it("resolves a missing parameter payload as absent", async () => {
    const seen: GetParameterCommand[] = [];
    const store = new SsmParameterStore({
      send: sendFor({}, seen),
    });

    await expect(store.readParameter(PARAM_NAME)).resolves.toBeUndefined();
  });

  it("lets transport failures propagate to the caller", async () => {
    const store = new SsmParameterStore({
      send: () => Promise.reject(new Error("denied")),
    });

    await expect(store.readParameter(PARAM_NAME)).rejects.toThrow("denied");
  });
});

describe("apiKeyFor", () => {
  it("prefers the literal key over SSM", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor(
        { directApiKey: LITERAL_KEY, ssmParameterName: PARAM_NAME },
        readerFor(SSM_KEY, calls),
      ),
    ).resolves.toBe(LITERAL_KEY);
    expect(calls).toEqual([]);
  });

  it("trims the literal key", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor(
        { directApiKey: `  ${LITERAL_KEY}  `, ssmParameterName: PARAM_NAME },
        readerFor(SSM_KEY, calls),
      ),
    ).resolves.toBe(LITERAL_KEY);
    expect(calls).toEqual([]);
  });

  it("falls through a blank literal key to SSM", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor(
        { directApiKey: "   ", ssmParameterName: PARAM_NAME },
        readerFor(SSM_KEY, calls),
      ),
    ).resolves.toBe(SSM_KEY);
    expect(calls).toEqual([PARAM_NAME]);
  });

  it("reads SSM when no literal key is set", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor({ ssmParameterName: PARAM_NAME }, readerFor(SSM_KEY, calls)),
    ).resolves.toBe(SSM_KEY);
    expect(calls).toEqual([PARAM_NAME]);
  });

  it("resolves keyless without calling SSM when no parameter is named", async () => {
    const calls: string[] = [];

    await expect(apiKeyFor({}, readerFor(SSM_KEY, calls))).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("resolves keyless without calling SSM for a blank parameter name", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor({ ssmParameterName: "   " }, readerFor(SSM_KEY, calls)),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("resolves keyless when SSM reports no value", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor({ ssmParameterName: PARAM_NAME }, readerFor(undefined, calls)),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([PARAM_NAME]);
  });

  it("resolves keyless when SSM itself fails", async () => {
    const calls: string[] = [];

    await expect(
      apiKeyFor(
        { ssmParameterName: PARAM_NAME },
        readerFor(undefined, calls, new Error("ParameterNotFound")),
      ),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([PARAM_NAME]);
  });
});
