import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  InvalidRetentionPolicyError,
  isArtifactExpired,
  MS_PER_DAY,
  RetentionPolicy,
} from "./retention-policy.ts";

function policy(): RetentionPolicy {
  return unwrap(
    RetentionPolicy.of({ artifactRetentionDays: 30, tenantId: "tenant-a" }),
  );
}

describe("RetentionPolicy", () => {
  it("constructs with the exact values it was given", () => {
    const value = policy();

    expect(value.artifactRetentionDays).toBe(30);
    expect(value.tenantId).toBe("tenant-a");
  });

  it.each([0, -1, 1.5])(
    "rejects %p as artifactRetentionDays",
    (artifactRetentionDays) => {
      expect(
        unwrapErr(
          RetentionPolicy.of({ artifactRetentionDays, tenantId: "tenant-a" }),
        ),
      ).toEqual(
        new InvalidRetentionPolicyError(
          "artifactRetentionDays must be a positive integer.",
        ),
      );
    },
  );

  it("accepts a single retention day as the smallest useful policy", () => {
    const value = unwrap(
      RetentionPolicy.of({ artifactRetentionDays: 1, tenantId: "tenant-a" }),
    );

    expect(value.artifactRetentionDays).toBe(1);
  });

  it.each(["", "   "])("rejects %p as tenantId", (tenantId) => {
    expect(
      unwrapErr(RetentionPolicy.of({ artifactRetentionDays: 30, tenantId })),
    ).toEqual(
      new InvalidRetentionPolicyError("tenantId must not be empty."),
    );
  });

  it("never applies to immutable event metadata", () => {
    expect(policy().appliesToEvents()).toBe(false);
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidRetentionPolicyError("boom").name).toBe(
      "InvalidRetentionPolicyError",
    );
  });
});

describe("isArtifactExpired", () => {
  it("is false one millisecond before the deadline", () => {
    expect(isArtifactExpired(0, 30 * MS_PER_DAY - 1, policy())).toBe(false);
  });

  it("is true exactly at the deadline", () => {
    expect(isArtifactExpired(0, 30 * MS_PER_DAY, policy())).toBe(true);
  });

  it("is true after the deadline", () => {
    expect(isArtifactExpired(0, 31 * MS_PER_DAY, policy())).toBe(true);
  });

  it("measures elapsed time from a nonzero origin, not wall-clock sums", () => {
    const storedAt = 1_000;

    expect(
      isArtifactExpired(storedAt, storedAt + 30 * MS_PER_DAY - 1, policy()),
    ).toBe(false);
    expect(
      isArtifactExpired(storedAt, storedAt + 30 * MS_PER_DAY, policy()),
    ).toBe(true);
  });
});
