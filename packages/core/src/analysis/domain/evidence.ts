import { err, ok, type Result } from "../../shared/result.ts";
import type { SourceLocation } from "./source-location.ts";

export class InvalidEvidenceError extends Error {
  override readonly name = "InvalidEvidenceError";
}

export interface EvidenceProps {
  readonly location: SourceLocation;
  /**
   * A minimal excerpt supporting the finding — not the whole file.
   *
   * Evidence is what a result is allowed to keep of the subject once
   * analysis is complete. Callers must not enlarge this to a whole file:
   * see the compliance baseline's evidence-minimization requirement
   * (tracked in #28) for why the full source is deliberately absent from
   * this contract.
   */
  readonly excerpt: string;
}

/**
 * A minimal excerpt of the subject, tied to where it was found.
 *
 * Immutable value object: the only way to obtain one is {@link Evidence.of},
 * which returns a {@link Result} rather than throwing — an empty excerpt is
 * an expected outcome of validating untrusted input, not an exceptional
 * condition.
 */
export class Evidence {
  private constructor(
    readonly location: SourceLocation,
    readonly excerpt: string,
  ) {}

  static of(props: EvidenceProps): Result<Evidence, InvalidEvidenceError> {
    if (props.excerpt.trim().length === 0) {
      return err(new InvalidEvidenceError("excerpt must not be empty."));
    }

    return ok(new Evidence(props.location, props.excerpt));
  }
}
