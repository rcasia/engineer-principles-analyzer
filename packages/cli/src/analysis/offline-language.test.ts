import { describe, expect, test } from "bun:test";
import {
  KNOWN_LANGUAGES,
  LANGUAGE_GUIDANCE,
  languageForFilename,
  resolveLanguage,
} from "./offline-language.ts";

describe("languageForFilename", () => {
  test.each([
    ["server.ts", "typescript"],
    ["component.tsx", "typescript"],
    ["module.mts", "typescript"],
    ["module.cts", "typescript"],
    ["app.js", "javascript"],
    ["view.jsx", "javascript"],
    ["app.mjs", "javascript"],
    ["app.cjs", "javascript"],
    ["main.py", "python"],
    ["tool.pyw", "python"],
    ["main.go", "go"],
    ["lib.rs", "rust"],
    ["Main.java", "java"],
  ])("maps %s to %s", (filename, language) => {
    expect(languageForFilename(filename)).toBe(language);
  });

  test("matches case-insensitively and ignores directories", () => {
    expect(languageForFilename("src/APP.TS")).toBe("typescript");
    expect(languageForFilename("C:\\proj\\main.PY")).toBe("python");
  });

  test("returns undefined when no known extension is present", () => {
    expect(languageForFilename("README")).toBeUndefined();
    expect(languageForFilename("notes.txt")).toBeUndefined();
    expect(languageForFilename(".gitignore")).toBeUndefined();
    expect(languageForFilename("archive.tar.gz")).toBeUndefined();
  });

  test("treats a leading-dot name as extensionless even for a known word", () => {
    expect(languageForFilename(".ts")).toBeUndefined();
    expect(languageForFilename(".py")).toBeUndefined();
  });
});

describe("resolveLanguage", () => {
  test("an explicit language wins over the filename", () => {
    expect(
      resolveLanguage({ language: "python", filename: "server.ts" }),
    ).toEqual({ ok: true, language: "python" });
  });

  test("normalizes an explicit language to lowercase", () => {
    expect(resolveLanguage({ language: "TypeScript" })).toEqual({
      ok: true,
      language: "typescript",
    });
  });

  test("trims surrounding whitespace from an explicit language", () => {
    expect(resolveLanguage({ language: "  typescript  " })).toEqual({
      ok: true,
      language: "typescript",
    });
  });

  test("falls back to the filename when the explicit language is blank", () => {
    expect(
      resolveLanguage({ language: "   ", filename: "main.py" }),
    ).toEqual({ ok: true, language: "python" });
  });

  test("asks for a language when the explicit language is blank and alone", () => {
    expect(resolveLanguage({ language: "" })).toEqual({
      ok: false,
      message:
        "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    });
  });

  test("rejects a language outside the judged set", () => {
    expect(resolveLanguage({ language: "haskell" })).toEqual({
      ok: false,
      message:
        "Unknown language: haskell. Expected one of typescript, javascript, python, go, rust, java.",
    });
  });

  test("falls back to the filename extension", () => {
    expect(resolveLanguage({ filename: "main.py" })).toEqual({
      ok: true,
      language: "python",
    });
  });

  test("asks for a language when nothing names one", () => {
    expect(resolveLanguage({})).toEqual({
      ok: false,
      message:
        "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    });
    expect(LANGUAGE_GUIDANCE).toBe(
      "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    );
  });

  test("asks for a language when the filename has no known extension", () => {
    const resolved = resolveLanguage({ filename: "notes.txt" });

    expect(resolved.ok).toBe(false);
  });

  test("covers exactly the six judged languages", () => {
    expect([...KNOWN_LANGUAGES]).toEqual([
      "typescript",
      "javascript",
      "python",
      "go",
      "rust",
      "java",
    ]);
  });
});
