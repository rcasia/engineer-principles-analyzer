import { describe, expect, it } from "bun:test";
import {
  JevLanguageDetector,
  type FetchFn,
  type FetchResponseLike,
} from "@principled/core";
import { detectorFor } from "./language-detector.ts";

function recordingFetch(calls: unknown[][]): FetchFn {
  return (async (url: string, init: unknown) => {
    calls.push([url, init]);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    } as FetchResponseLike;
  }) as FetchFn;
}

describe("detectorFor", () => {
  it("asks Jev when a key is present", async () => {
    const calls: unknown[][] = [];
    const detector = detectorFor("key-1", recordingFetch(calls));

    expect(detector).toBeInstanceOf(JevLanguageDetector);
    await expect(
      detector.detectLanguage("const x: number = 1;", "a.ts"),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("never calls Jev for a blank buffer even with a key", async () => {
    const calls: unknown[][] = [];
    const detector = detectorFor("key-1", recordingFetch(calls));

    await expect(detector.detectLanguage("   ")).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("reports undetectable without calling Jev when the key is missing", async () => {
    const calls: unknown[][] = [];
    const detector = detectorFor(undefined, recordingFetch(calls));

    expect(detector).not.toBeInstanceOf(JevLanguageDetector);
    await expect(
      detector.detectLanguage("const x: number = 1;", "a.ts"),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("treats a whitespace-only key as missing", async () => {
    const calls: unknown[][] = [];
    const detector = detectorFor("   ", recordingFetch(calls));

    await expect(
      detector.detectLanguage("const x: number = 1;", "a.ts"),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("reports a blank buffer as undetectable without a key", async () => {
    const calls: unknown[][] = [];
    const detector = detectorFor(undefined, recordingFetch(calls));

    await expect(detector.detectLanguage("")).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
