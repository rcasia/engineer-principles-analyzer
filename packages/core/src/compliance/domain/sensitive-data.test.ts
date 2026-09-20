import { describe, expect, it } from "bun:test";
import {
  assertTelemetrySafe,
  findForbiddenKeys,
  FORBIDDEN_TELEMETRY_KEYS,
  resolveTelemetryOptIn,
  TelemetryContainsSensitiveDataError,
  TELEMETRY_ENABLED_BY_DEFAULT,
} from "./sensitive-data.ts";

describe("telemetry opt-in", () => {
  it("is disabled by default", () => {
    expect(TELEMETRY_ENABLED_BY_DEFAULT).toBe(false);
  });

  it("stays off without an explicit opt-in", () => {
    expect(resolveTelemetryOptIn(undefined)).toBe(false);
  });

  it("stays off on an explicit refusal", () => {
    expect(resolveTelemetryOptIn(false)).toBe(false);
  });

  it("turns on only on an explicit opt-in", () => {
    expect(resolveTelemetryOptIn(true)).toBe(true);
  });
});

describe("forbidden telemetry keys", () => {
  it("lists every guarded category", () => {
    expect([...FORBIDDEN_TELEMETRY_KEYS]).toEqual([
      "sourceCode",
      "prompt",
      "finding",
      "findings",
      "evidence",
      "explanation",
      "remediation",
      "repository",
      "authorization",
      "cookie",
      "password",
      "secret",
      "token",
      "credential",
      "apiKey",
      "email",
    ]);
  });

  it("finds nothing in primitives", () => {
    expect(findForbiddenKeys(undefined)).toEqual([]);
    expect(findForbiddenKeys(null)).toEqual([]);
    expect(findForbiddenKeys(42)).toEqual([]);
    expect(findForbiddenKeys("sourceCode")).toEqual([]);
    expect(findForbiddenKeys(true)).toEqual([]);
  });

  it("finds a forbidden key at the top level", () => {
    expect(findForbiddenKeys({ sourceCode: "const a = 1;" })).toEqual([
      "sourceCode",
    ]);
  });

  it("matches keys case-insensitively", () => {
    expect(findForbiddenKeys({ SourceCode: "const a = 1;" })).toEqual([
      "sourceCode",
    ]);
    expect(findForbiddenKeys({ AUTHORIZATION: "Bearer x" })).toEqual([
      "authorization",
    ]);
  });

  it("finds forbidden keys nested inside objects and arrays", () => {
    expect(
      findForbiddenKeys({
        run: { id: "abc", prompt: "judge this" },
        items: [{ findings: [1], ok: true }, { email: "a@b.c" }],
      }),
    ).toEqual(["prompt", "findings", "email"]);
  });

  it("reports each key once in first-seen order", () => {
    expect(
      findForbiddenKeys([
        { token: "a" },
        { nested: { token: "b", secret: "c" } },
        { token: "d" },
      ]),
    ).toEqual(["token", "secret"]);
  });

  it("ignores safe analytics-shaped payloads", () => {
    expect(
      findForbiddenKeys({
        analysisId: "abc",
        language: "typescript",
        ruleId: "srp",
        durationMs: 12,
        status: "violation",
        confidence: 0.8,
      }),
    ).toEqual([]);
  });

  it("terminates on cyclic values", () => {
    const cyclic: Record<string, unknown> = { language: "typescript" };
    cyclic.self = cyclic;

    expect(findForbiddenKeys(cyclic)).toEqual([]);
  });

  it("still reports a forbidden key reachable through a cycle", () => {
    const cyclic: Record<string, unknown> = { cookie: "session=1" };
    cyclic.self = cyclic;

    expect(findForbiddenKeys(cyclic)).toEqual(["cookie"]);
  });
});

describe("assertTelemetrySafe", () => {
  it("passes a safe payload without throwing", () => {
    expect(() =>
      assertTelemetrySafe({ language: "typescript", durationMs: 12 }),
    ).not.toThrow();
  });

  it("throws naming every forbidden key it found", () => {
    try {
      assertTelemetrySafe({ sourceCode: "x", nested: { prompt: "y" } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TelemetryContainsSensitiveDataError);
      expect((error as TelemetryContainsSensitiveDataError).keys).toEqual([
        "sourceCode",
        "prompt",
      ]);
      expect((error as Error).message).toBe(
        "Telemetry payload contains forbidden keys: sourceCode, prompt.",
      );
      expect((error as Error).name).toBe("TelemetryContainsSensitiveDataError");
    }
  });
});
