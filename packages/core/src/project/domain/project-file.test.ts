import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { hashSource, InvalidProjectFileError, ProjectFile } from "./project-file.ts";

describe("ProjectFile", () => {
  it("constructs with the exact fields it was given", () => {
    const file = unwrap(
      ProjectFile.of({
        path: "src/index.ts",
        language: "typescript",
        sourceCode: "export const x = 1;",
      }),
    );

    expect(file.path).toBe("src/index.ts");
    expect(file.language).toBe("typescript");
    expect(file.sourceCode).toBe("export const x = 1;");
  });

  it.each(["", "   "])("rejects %p as path", (path) => {
    expect(
      unwrapErr(ProjectFile.of({ path, language: "typescript", sourceCode: "x = 1" })),
    ).toEqual(new InvalidProjectFileError("file path must not be empty."));
  });

  it.each(["", "   "])("rejects %p as language", (language) => {
    expect(
      unwrapErr(ProjectFile.of({ path: "a.ts", language, sourceCode: "x = 1" })),
    ).toEqual(new InvalidProjectFileError("language must not be empty."));
  });

  it.each(["", "   "])("rejects %p as sourceCode", (sourceCode) => {
    expect(
      unwrapErr(ProjectFile.of({ path: "a.ts", language: "typescript", sourceCode })),
    ).toEqual(new InvalidProjectFileError("sourceCode must not be empty."));
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidProjectFileError("boom").name).toBe("InvalidProjectFileError");
  });

  it("exposes a reference without source text", () => {
    const file = unwrap(
      ProjectFile.of({ path: "a.ts", language: "typescript", sourceCode: "x = 1" }),
    );

    expect(file.toReference()).toEqual({
      path: "a.ts",
      language: "typescript",
      sourceLength: 5,
      contentHash: hashSource("x = 1"),
    });
    expect(JSON.stringify(file.toReference())).not.toContain("x = 1");
  });
});

describe("hashSource", () => {
  it("hashes the empty string to the FNV offset basis", () => {
    expect(hashSource("")).toBe("811c9dc5");
  });

  it("is deterministic and distinguishes inputs", () => {
    expect(hashSource("x = 1")).toBe(hashSource("x = 1"));
    expect(hashSource("x = 1")).not.toBe(hashSource("x = 2"));
  });
});
