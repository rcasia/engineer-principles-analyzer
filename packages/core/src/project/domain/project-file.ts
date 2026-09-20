import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidProjectFileError extends Error {
  override readonly name = "InvalidProjectFileError";
}

export interface ProjectFileProps {
  /** Repository-relative path, e.g. `"src/index.ts"`. */
  readonly path: string;
  /** The language to analyze `sourceCode` as, e.g. `"typescript"`. */
  readonly language: string;
  /** The file's content. Never leaves the write side: events carry a reference, not this. */
  readonly sourceCode: string;
}

/**
 * A stable reference to a project file that is safe for immutable events:
 * identity and integrity facts, never source text (ADR-0012, #22, #28).
 */
export interface ProjectFileReference {
  readonly path: string;
  readonly language: string;
  readonly sourceLength: number;
  readonly contentHash: string;
}

/**
 * One file of a project-level analysis input (#38).
 *
 * Immutable value object: the only way to obtain one is {@link ProjectFile.of},
 * which returns a {@link Result} rather than throwing — an empty path or
 * language is an expected outcome of validating caller input, not an
 * exceptional condition.
 */
export class ProjectFile {
  private constructor(
    readonly path: string,
    readonly language: string,
    readonly sourceCode: string,
  ) {}

  static of(props: ProjectFileProps): Result<ProjectFile, InvalidProjectFileError> {
    if (props.path.trim().length === 0) {
      return err(new InvalidProjectFileError("file path must not be empty."));
    }

    if (props.language.trim().length === 0) {
      return err(new InvalidProjectFileError("language must not be empty."));
    }

    if (props.sourceCode.trim().length === 0) {
      return err(new InvalidProjectFileError("sourceCode must not be empty."));
    }

    return ok(new ProjectFile(props.path, props.language, props.sourceCode));
  }

  /**
   * The erasable-artifact counterpart of this file: everything a retention
   * policy, an event payload or a read model may hold without becoming a
   * second copy of customer source (#22, ADR-0012 "Sensitive customer data").
   */
  toReference(): ProjectFileReference {
    return {
      path: this.path,
      language: this.language,
      sourceLength: this.sourceCode.length,
      contentHash: hashSource(this.sourceCode),
    };
  }
}

/**
 * Content integrity hash for file references. FNV-1a 32-bit, hex-encoded.
 * Deliberately a hand-rolled pure function rather than a crypto API: the
 * domain performs no I/O (ADR-0002), and references only need to detect
 * accidental drift, not to resist an adversary.
 */
export function hashSource(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
