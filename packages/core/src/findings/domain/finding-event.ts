/**
 * The facts a finding's lifecycle can hold in its event stream (#26
 * "finding lifecycle state must be reconstructed from events", #42
 * "state transitions are recorded as domain events"): detection plus one
 * event per accepted transition.
 *
 * Sensitive artifacts never enter these payloads: detection carries a
 * location reference and a content hash — enough to point at the finding
 * and to notice drift — never an excerpt or source text. History is
 * therefore auditable without embedding source code in immutable events
 * (#42 "auditable without embedding source code", ADR-0012).
 */
export const FINDING_DETECTED_EVENT = "FindingDetected";
export const FINDING_ACCEPTED_EVENT = "FindingAccepted";
export const FINDING_SUPPRESSED_EVENT = "FindingSuppressed";
export const FINDING_RESOLVED_EVENT = "FindingResolved";
export const FINDING_REOPENED_EVENT = "FindingReopened";

export interface FindingDetectedPayload {
  readonly findingId: string;
  readonly ruleId: string;
  /** Exact rule version pinned at detection, when known. */
  readonly ruleVersion: string | undefined;
  /** Where the finding was observed. A reference, not content. */
  readonly filePath: string | undefined;
  readonly startLine: number | undefined;
  /** Integrity reference for the finding's evidence, never the evidence itself. */
  readonly findingHash: string;
}

export interface FindingAcceptedPayload {
  readonly findingId: string;
  readonly reason: string | undefined;
  readonly acceptedBy: string | undefined;
}

export interface FindingSuppressedPayload {
  readonly findingId: string;
  /** Required: muting a finding without saying why is not auditable. */
  readonly reason: string;
  readonly suppressedBy: string | undefined;
  readonly expiresAt: string | undefined;
}

export interface FindingResolvedPayload {
  readonly findingId: string;
  readonly reason: string | undefined;
  readonly resolvedBy: string | undefined;
}

export interface FindingReopenedPayload {
  readonly findingId: string;
  readonly reason: string | undefined;
}

export type FindingEventPayload =
  | FindingDetectedPayload
  | FindingAcceptedPayload
  | FindingSuppressedPayload
  | FindingResolvedPayload
  | FindingReopenedPayload;
