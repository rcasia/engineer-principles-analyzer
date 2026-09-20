import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidFindingRetentionError extends Error {
  override readonly name = "InvalidFindingRetentionError";
}

export interface FindingRetentionProps {
  /** Days persisted finding history (transition events) is kept. */
  readonly historyRetentionDays: number;
  /** Days erasable finding artifacts (evidence snapshots) are kept. */
  readonly artifactDeletionDays: number;
}

/** Milliseconds in one day. Exported so tests assert the boundary literally. */
export const FINDING_MS_PER_DAY = 86_400_000;

/**
 * Retention and deletion for persisted finding history (#26 "retention,
 * deletion, access-control and privacy requirements", #42 "retention and
 * deletion rules apply to persisted history").
 *
 * Two separate knobs for the two separate stores: transition history —
 * minimal facts, no source — lives for `historyRetentionDays` so the audit
 * trail survives as long as the findings are actionable; erasable
 * artifacts derived from customer code are due for deletion after
 * `artifactDeletionDays`. Exactly-at-deadline counts as due in both cases:
 * at the deadline the record is due, not granted another day.
 *
 * Deletion completion itself is observable through the artifact store's
 * delete operation; these predicates decide *when*, the store reports
 * *whether*.
 */
export class FindingRetentionPolicy {
  private constructor(
    readonly historyRetentionDays: number,
    readonly artifactDeletionDays: number,
  ) {}

  static of(
    props: FindingRetentionProps,
  ): Result<FindingRetentionPolicy, InvalidFindingRetentionError> {
    if (!Number.isInteger(props.historyRetentionDays) || props.historyRetentionDays < 1) {
      return err(
        new InvalidFindingRetentionError(
          "historyRetentionDays must be a positive integer.",
        ),
      );
    }

    if (!Number.isInteger(props.artifactDeletionDays) || props.artifactDeletionDays < 1) {
      return err(
        new InvalidFindingRetentionError(
          "artifactDeletionDays must be a positive integer.",
        ),
      );
    }

    return ok(
      new FindingRetentionPolicy(props.historyRetentionDays, props.artifactDeletionDays),
    );
  }
}

/** Whether finding history last active at `lastTransitionAtMs` has expired as of `nowMs`. */
export function isFindingHistoryExpired(
  lastTransitionAtMs: number,
  nowMs: number,
  policy: FindingRetentionPolicy,
): boolean {
  return nowMs - lastTransitionAtMs >= policy.historyRetentionDays * FINDING_MS_PER_DAY;
}

/** Whether finding artifacts stored at `storedAtMs` are due for deletion as of `nowMs`. */
export function isFindingArtifactDeletionDue(
  storedAtMs: number,
  nowMs: number,
  policy: FindingRetentionPolicy,
): boolean {
  return nowMs - storedAtMs >= policy.artifactDeletionDays * FINDING_MS_PER_DAY;
}
