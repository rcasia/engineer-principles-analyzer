import { err, ok, type Result } from "../../shared/result.ts";
import type { ProjectFile } from "./project-file.ts";

export class InvalidProjectError extends Error {
  override readonly name = "InvalidProjectError";
}

/**
 * The multi-file input of project-level analysis (#22, #38): a set of files
 * analyzed as one unit so rules can reason about relationships no single
 * file shows on its own.
 *
 * Immutable value object: the only way to obtain one is {@link Project.of}.
 * Paths are unique within a project — two files at the same path would make
 * cross-file evidence ambiguous.
 */
export class Project {
  private constructor(readonly files: readonly ProjectFile[]) {}

  static of(files: readonly ProjectFile[]): Result<Project, InvalidProjectError> {
    if (files.length === 0) {
      return err(
        new InvalidProjectError("project must contain at least one file."),
      );
    }

    const seen = new Set<string>();
    for (const file of files) {
      if (seen.has(file.path)) {
        return err(
          new InvalidProjectError(`duplicate file path "${file.path}".`),
        );
      }
      seen.add(file.path);
    }

    return ok(new Project([...files]));
  }

  /** How many files the project holds. */
  get fileCount(): number {
    return this.files.length;
  }

  /** Every file path, in the order the files were given. */
  filePaths(): readonly string[] {
    return this.files.map((file) => file.path);
  }

  /** Every language present, deduplicated in first-seen order. */
  languages(): readonly string[] {
    const seen = new Set<string>();
    for (const file of this.files) {
      seen.add(file.language);
    }
    return [...seen];
  }

  find(path: string): ProjectFile | undefined {
    return this.files.find((file) => file.path === path);
  }
}
