import { describe, expect, test } from "bun:test";
import { isSupportedLanguage } from "./supported-language.ts";

describe("isSupportedLanguage", () => {
  test("supports typescript", () => {
    expect(isSupportedLanguage("typescript")).toBe(true);
  });

  test("supports javascript", () => {
    expect(isSupportedLanguage("javascript")).toBe(true);
  });

  test("supports java", () => {
    expect(isSupportedLanguage("java")).toBe(true);
  });

  test("supports python", () => {
    expect(isSupportedLanguage("python")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isSupportedLanguage("TypeScript")).toBe(true);
  });

  test("is case-insensitive for python", () => {
    expect(isSupportedLanguage("Python")).toBe(true);
  });

  test("trims surrounding whitespace", () => {
    expect(isSupportedLanguage("  typescript  ")).toBe(true);
  });

  test("does not support go", () => {
    expect(isSupportedLanguage("go")).toBe(false);
  });

  test("does not support rust", () => {
    expect(isSupportedLanguage("rust")).toBe(false);
  });

  test("does not support an empty string", () => {
    expect(isSupportedLanguage("")).toBe(false);
  });
});
