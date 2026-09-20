import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  FINDING_MS_PER_DAY,
  FindingRetentionPolicy,
  InvalidFindingRetentionError,
  isFindingArtifactDeletionDue,
  isFindingHistoryExpired,
} from "./finding-retention.ts";

function policy(): FindingRetentionPolicy {
  return unwrap(
    FindingRetentionPolicy.of({ historyRetentionDays: 90, artifactDeletionDays: 30 }),
  );
}

describe("FindingRetentionPolicy", () => {
  it("constructs with the exact values it was given", () => {
    const value = policy();

    expect(value.historyRetentionDays).toBe(90);
    expect(value.artifactDeletionDays).toBe(30);
  });

  it.each([0, -1, 1.5])(
    "rejects %p as historyRetentionDays",
    (historyRetentionDays) => {
      expect(
        unwrapErr(
          FindingRetentionPolicy.of({ historyRetentionDays, artifactDeletionDays: 30 }),
        ),
      ).toEqual(
        new InvalidFindingRetentionError(
          "historyRetentionDays must be a positive integer.",
        ),
      );
    },
  );

  it.each([0, -1, 2.5])(
    "rejects %p as artifactDeletionDays",
    (artifactDeletionDays) => {
      expect(
        unwrapErr(
          FindingRetentionPolicy.of({ historyRetentionDays: 90, artifactDeletionDays }),
        ),
      ).toEqual(
        new InvalidFindingRetentionError(
          "artifactDeletionDays must be a positive integer.",
        ),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidFindingRetentionError("boom").name).toBe(
      "InvalidFindingRetentionError",
    );
  });
});

describe("isFindingHistoryExpired", () => {
  it("is false one millisecond before the deadline", () => {
    expect(isFindingHistoryExpired(0, 90 * FINDING_MS_PER_DAY - 1, policy())).toBe(
      false,
    );
  });

  it("is true exactly at the deadline", () => {
    expect(isFindingHistoryExpired(0, 90 * FINDING_MS_PER_DAY, policy())).toBe(true);
  });
});

describe("isFindingArtifactDeletionDue", () => {
  it("is false one millisecond before the deadline", () => {
    expect(isFindingArtifactDeletionDue(0, 30 * FINDING_MS_PER_DAY - 1, policy())).toBe(
      false,
    );
  });

  it("is true exactly at the deadline", () => {
    expect(isFindingArtifactDeletionDue(0, 30 * FINDING_MS_PER_DAY, policy())).toBe(
      true,
    );
  });
});
