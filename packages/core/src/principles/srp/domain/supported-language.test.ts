import { describe, expect, test } from "bun:test";
import { isSupportedLanguage } from "./supported-language.ts";

describe("isSupportedLanguage", () => {
  test("supports typescript", () => {
    expect(isSupportedLanguage("typescript")).toBe(true);
  });

  test("supports javascript", () => {
    expect(isSupportedLanguage("javascript")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isSupportedLanguage("TypeScript")).toBe(true);
  });

  test("trims surrounding whitespace", () => {
    expect(isSupportedLanguage("  typescript  ")).toBe(true);
  });

  test("does not support python", () => {
    expect(isSupportedLanguage("python")).toBe(false);
  });

  test("does not support go", () => {
    expect(isSupportedLanguage("go")).toBe(false);
  });

  test("does not support an empty string", () => {
    expect(isSupportedLanguage("")).toBe(false);
  });
});
