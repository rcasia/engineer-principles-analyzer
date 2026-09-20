import { describe, expect, it } from "bun:test";
import {
  AUTO_DETECT_LABEL,
  extensionFor,
  languageLabel,
  UNDETECTED_LANGUAGE_MESSAGE,
} from "./language-display.ts";

describe("language-display", () => {
  it("names auto-detect for an unknown language", () => {
    expect(languageLabel("")).toBe("Auto-detect");
    expect(AUTO_DETECT_LABEL).toBe("Auto-detect");
  });

  it("explains a detection failure with the message the server renders", () => {
    expect(UNDETECTED_LANGUAGE_MESSAGE).toBe(
      "Could not detect the programming language. Please include more distinctive code or upload a file with a known extension.",
    );
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
