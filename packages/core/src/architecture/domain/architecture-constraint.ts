import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidArchitectureConstraintError extends Error {
  override readonly name = "InvalidArchitectureConstraintError";
}

export const ARCHITECTURE_CONSTRAINT_KINDS = ["forbidden", "allowed"] as const;

export type ArchitectureConstraintKind =
  (typeof ARCHITECTURE_CONSTRAINT_KINDS)[number];

export function isArchitectureConstraintKind(
  value: string,
): value is ArchitectureConstraintKind {
  return (
    value === "forbidden" || value === "allowed"
  );
}

export interface ArchitectureConstraintProps {
  /** Stable identifier, e.g. `"no-ui-to-db"`. Names the result rule `architecture.<id>`. */
  readonly id: string;
  /** Path prefix the dependency source must match, e.g. `"ui"`. */
  readonly fromPattern: string;
  /** Path prefix the dependency target must (or must not) match, e.g. `"db"`. */
  readonly toPattern: string;
  /**
   * `"forbidden"`: any reachable path from `fromPattern` to `toPattern`
   * violates. `"allowed"`: edges from `fromPattern` may only reach
   * `toPattern`; anything else violates.
   */
  readonly kind: ArchitectureConstraintKind;
  readonly description?: string;
}

/**
 * One permitted or forbidden dependency direction between parts of a
 * project (#39 "rules can express permitted and forbidden dependency
 * directions").
 *
 * Immutable value object: the only way to obtain one is
 * {@link ArchitectureConstraint.of}. Patterns match a whole path segment:
 * `"ui"` matches `"ui"` and `"ui/button.ts"` but not `"ui-kit/x.ts"`.
 */
export class ArchitectureConstraint {
  private constructor(
    readonly id: string,
    readonly fromPattern: string,
    readonly toPattern: string,
    readonly kind: ArchitectureConstraintKind,
    readonly description: string | undefined,
  ) {}

  static of(
    props: ArchitectureConstraintProps,
  ): Result<ArchitectureConstraint, InvalidArchitectureConstraintError> {
    if (props.id.trim().length === 0) {
      return err(
        new InvalidArchitectureConstraintError("constraint id must not be empty."),
      );
    }

    if (props.fromPattern.trim().length === 0) {
      return err(
        new InvalidArchitectureConstraintError(
          "fromPattern must not be empty.",
        ),
      );
    }

    if (props.toPattern.trim().length === 0) {
      return err(
        new InvalidArchitectureConstraintError("toPattern must not be empty."),
      );
    }

    if (!isArchitectureConstraintKind(props.kind)) {
      return err(
        new InvalidArchitectureConstraintError(
          `kind must be "forbidden" or "allowed", got "${props.kind}".`,
        ),
      );
    }

    return ok(
      new ArchitectureConstraint(
        props.id,
        props.fromPattern,
        props.toPattern,
        props.kind,
        props.description,
      ),
    );
  }
}

/**
 * Whether a repository-relative path falls under a constraint pattern:
 * exact match or a whole leading segment (`"ui"` matches `"ui/a.ts"`).
 */
export function matchesPath(path: string, pattern: string): boolean {
  return path === pattern || path.startsWith(`${pattern}/`);
}
