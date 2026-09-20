import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { ProjectFile } from "./project-file.ts";
import { InvalidProjectError, Project } from "./project.ts";

function file(path: string, language = "typescript"): ProjectFile {
  return unwrap(ProjectFile.of({ path, language, sourceCode: `// ${path}` }));
}

describe("Project", () => {
  it("constructs over the exact files it was given", () => {
    const project = unwrap(Project.of([file("a.ts"), file("b.ts")]));

    expect(project.fileCount).toBe(2);
    expect(project.filePaths()).toEqual(["a.ts", "b.ts"]);
  });

  it("rejects an empty project", () => {
    expect(unwrapErr(Project.of([]))).toEqual(
      new InvalidProjectError("project must contain at least one file."),
    );
  });

  it("rejects duplicate file paths", () => {
    expect(unwrapErr(Project.of([file("a.ts"), file("a.ts")]))).toEqual(
      new InvalidProjectError('duplicate file path "a.ts".'),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidProjectError("boom").name).toBe("InvalidProjectError");
  });

  it("lists languages deduplicated in first-seen order", () => {
    const project = unwrap(
      Project.of([file("a.ts"), file("b.py", "python"), file("c.ts")]),
    );

    expect(project.languages()).toEqual(["typescript", "python"]);
  });

  it("finds a file by path and misses unknown paths", () => {
    const project = unwrap(Project.of([file("a.ts")]));

    expect(project.find("a.ts")?.path).toBe("a.ts");
    expect(project.find("missing.ts")).toBeUndefined();
  });
});
