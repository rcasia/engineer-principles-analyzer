import { describe, expect, it } from "bun:test";
import {
  AUTO_DETECT_LABEL,
  extensionFor,
  languageLabel,
} from "./language-display.ts";

describe("language-display", () => {
  it("names auto-detect for an unknown language", () => {
    expect(languageLabel("")).toBe("Auto-detect");
    expect(AUTO_DETECT_LABEL).toBe("Auto-detect");
  });

  it.each([
    ["typescript", "TypeScript"],
    ["javascript", "JavaScript"],
    ["python", "Python"],
    ["go", "Go"],
    ["rust", "Rust"],
    ["java", "Java"],
    ["  TYPESCRIPT ", "TypeScript"],
  ])("names %p as %p", (language, label) => {
    expect(languageLabel(language)).toBe(label);
  });

  it("echoes an unlisted language untouched", () => {
    expect(languageLabel("haskell")).toBe("haskell");
  });

  it.each([
    ["typescript", "ts"],
    ["javascript", "js"],
    ["python", "py"],
    ["go", "go"],
    ["rust", "rs"],
    ["java", "java"],
    ["", "txt"],
    ["haskell", "txt"],
  ])("maps %p to the %p extension", (language, extension) => {
    expect(extensionFor(language)).toBe(extension);
  });
});
