import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidSourceLocationError extends Error {
  override readonly name = "InvalidSourceLocationError";
}

export interface SourceLocationProps {
  /**
   * Omitted for single-file analysis where the file is implicit (e.g. code
   * pasted into the web UI) rather than read from a project.
   */
  readonly filePath?: string;
  readonly startLine: number;
  readonly startColumn?: number;
  /** Defaults to `startLine`, for a location that spans a single line. */
  readonly endLine?: number;
  readonly endColumn?: number;
}

/**
 * Where in a subject a finding was observed.
 *
 * Deliberately does not carry the source line itself — see {@link Evidence}
 * for the minimal excerpt. Keeping location and content separate lets a
 * caller drop the excerpt (for storage, logging, or a summary view) while
 * still being able to point a user at the exact place in their code.
 *
 * Lines and columns are 1-based, matching how editors and terminals report
 * position, and how every language server protocol implementation the CLI
 * and web UI already interoperate with numbers them.
 *
 * Immutable value object: the only way to obtain one is
 * {@link SourceLocation.of}, which returns a {@link Result} rather than
 * throwing — a malformed line or column is an expected outcome of
 * validating untrusted input, not an exceptional condition.
 */
export class SourceLocation {
  private constructor(
    readonly filePath: string | undefined,
    readonly startLine: number,
    readonly startColumn: number | undefined,
    readonly endLine: number,
    readonly endColumn: number | undefined,
  ) {}

  static of(
    props: SourceLocationProps,
  ): Result<SourceLocation, InvalidSourceLocationError> {
    const { filePath, startLine, startColumn, endColumn } = props;
    const endLine = props.endLine ?? startLine;

    if (!isPositiveInteger(startLine)) {
      return err(
        new InvalidSourceLocationError(
          "startLine must be a positive integer.",
        ),
      );
    }

    if (!isPositiveInteger(endLine)) {
      return err(
        new InvalidSourceLocationError("endLine must be a positive integer."),
      );
    }

    if (endLine < startLine) {
      return err(
        new InvalidSourceLocationError(
          "endLine must not be before startLine.",
        ),
      );
    }

    if (startColumn !== undefined && !isPositiveInteger(startColumn)) {
      return err(
        new InvalidSourceLocationError(
          "startColumn must be a positive integer.",
        ),
      );
    }

    if (endColumn !== undefined && !isPositiveInteger(endColumn)) {
      return err(
        new InvalidSourceLocationError(
          "endColumn must be a positive integer.",
        ),
      );
    }

    if (startLine === endLine && !columnsInOrder(startColumn, endColumn)) {
      return err(
        new InvalidSourceLocationError(
          "endColumn must not be before startColumn on the same line.",
        ),
      );
    }

    return ok(
      new SourceLocation(filePath, startLine, startColumn, endLine, endColumn),
    );
  }

  equals(other: SourceLocation): boolean {
    return (
      this.filePath === other.filePath &&
      this.startLine === other.startLine &&
      this.startColumn === other.startColumn &&
      this.endLine === other.endLine &&
      this.endColumn === other.endColumn
    );
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/**
 * Column order only constrains locations that pin both columns: when
 * either column is absent there is nothing to compare, so any order is
 * accepted. Extracted so the guard reads as one decision.
 */
function columnsInOrder(
  startColumn: number | undefined,
  endColumn: number | undefined,
): boolean {
  if (startColumn === undefined || endColumn === undefined) {
    return true;
  }

  return endColumn >= startColumn;
}
