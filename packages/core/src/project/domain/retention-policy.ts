import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidRetentionPolicyError extends Error {
  override readonly name = "InvalidRetentionPolicyError";
}

export interface RetentionPolicyProps {
  /** Days an erasable repository artifact may be kept. */
  readonly artifactRetentionDays: number;
  /** Tenant the policy applies to. Artifact storage is always tenant-scoped. */
  readonly tenantId: string;
}

/** Milliseconds in one day. Exported so tests assert the boundary literally. */
export const MS_PER_DAY = 86_400_000;

/**
 * Retention/deletion behavior for repository artifacts (#22 "Event sourcing",
 * #38 "retention, deletion and tenant isolation are defined before private
 * repository data is persisted").
 *
 * The split this policy encodes: immutable event metadata is never purged
 * by retention — events hold no source (see `domain/project-event.ts`) —
 * while every erasable artifact (file references derived from hosted
 * repository data) expires after `artifactRetentionDays` and is deleted on
 * request. `appliesToEvents` returns `false` unconditionally so a caller
 * cannot mistake a retention sweep for permission to rewrite history.
 */
export class RetentionPolicy {
  private constructor(
    readonly artifactRetentionDays: number,
    readonly tenantId: string,
  ) {}

  static of(
    props: RetentionPolicyProps,
  ): Result<RetentionPolicy, InvalidRetentionPolicyError> {
    if (!Number.isInteger(props.artifactRetentionDays) || props.artifactRetentionDays < 1) {
      return err(
        new InvalidRetentionPolicyError(
          "artifactRetentionDays must be a positive integer.",
        ),
      );
    }

    if (props.tenantId.trim().length === 0) {
      return err(
        new InvalidRetentionPolicyError("tenantId must not be empty."),
      );
    }

    return ok(new RetentionPolicy(props.artifactRetentionDays, props.tenantId));
  }

  /** Retention never purges immutable event metadata. Always `false`. */
  appliesToEvents(): boolean {
    return false;
  }
}

/**
 * Whether an artifact stored at `storedAtMs` has expired as of `nowMs`.
 * Exactly-at-retention counts as expired: at the deadline the artifact is
 * due for deletion, not granted another day.
 */
export function isArtifactExpired(
  storedAtMs: number,
  nowMs: number,
  policy: RetentionPolicy,
): boolean {
  return nowMs - storedAtMs >= policy.artifactRetentionDays * MS_PER_DAY;
}
