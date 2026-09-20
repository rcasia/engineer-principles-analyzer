import { describe, expect, test } from "bun:test";
import { isSupportedLanguage } from "./supported-language.ts";

describe("isSupportedLanguage", () => {
  test("supports typescript and javascript", () => {
    expect(isSupportedLanguage("typescript")).toBe(true);
    expect(isSupportedLanguage("javascript")).toBe(true);
  });

  test("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isSupportedLanguage("TypeScript")).toBe(true);
    expect(isSupportedLanguage("  javascript  ")).toBe(true);
  });

  test("rejects anything else, including the empty string", () => {
    expect(isSupportedLanguage("python")).toBe(false);
    expect(isSupportedLanguage("rust")).toBe(false);
    expect(isSupportedLanguage("")).toBe(false);
  });
});
