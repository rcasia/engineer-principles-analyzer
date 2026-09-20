import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidFindingTransitionError extends Error {
  override readonly name = "InvalidFindingTransitionError";
}

export const FINDING_STATUSES = [
  "open",
  "accepted",
  "suppressed",
  "resolved",
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

export function isFindingStatus(value: string): value is FindingStatus {
  return (
    value === "open" ||
    value === "accepted" ||
    value === "suppressed" ||
    value === "resolved"
  );
}

/**
 * Whether a finding may move directly from one lifecycle state to another
 * (#42 "findings have an explicit lifecycle"):
 *
 * - `open` → `accepted` (confirmed), `suppressed` (intentionally muted),
 *   `resolved` (fixed);
 * - `accepted` → back to `open`, on to `suppressed` or `resolved`;
 * - `suppressed` → back to `open` (unsuppressed) or on to `resolved`;
 * - `resolved` → back to `open` (regressed).
 *
 * Anything else — resolving a suppressed finding without reopening is
 * allowed, but accepting a resolved one is not — must go through the
 * listed transitions so the audit trail never skips a decision.
 */
export function canTransition(from: FindingStatus, to: FindingStatus): boolean {
  switch (from) {
    case "open":
      return to === "accepted" || to === "suppressed" || to === "resolved";
    case "accepted":
      return to === "open" || to === "suppressed" || to === "resolved";
    case "suppressed":
      return to === "open" || to === "resolved";
    case "resolved":
      return to === "open";
  }
}

/**
 * The validated form of {@link canTransition}: the target status on
 * success, an error value naming the refused transition on failure.
 */
export function transitionStatus(
  from: FindingStatus,
  to: FindingStatus,
): Result<FindingStatus, InvalidFindingTransitionError> {
  if (from === to) {
    return err(
      new InvalidFindingTransitionError(
        `finding is already "${from}".`,
      ),
    );
  }
  if (!canTransition(from, to)) {
    return err(
      new InvalidFindingTransitionError(
        `cannot transition finding from "${from}" to "${to}".`,
      ),
    );
  }
  return ok(to);
}
