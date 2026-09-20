import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  canTransition,
  FINDING_STATUSES,
  InvalidFindingTransitionError,
  isFindingStatus,
  transitionStatus,
  type FindingStatus,
} from "./finding-state.ts";

describe("isFindingStatus", () => {
  it("accepts exactly the four lifecycle states", () => {
    expect(FINDING_STATUSES).toEqual(["open", "accepted", "suppressed", "resolved"]);
    for (const status of FINDING_STATUSES) {
      expect(isFindingStatus(status)).toBe(true);
    }
    expect(isFindingStatus("closed")).toBe(false);
    expect(isFindingStatus("")).toBe(false);
  });
});

describe("canTransition", () => {
  it.each([
    ["open", "accepted"],
    ["open", "suppressed"],
    ["open", "resolved"],
    ["accepted", "open"],
    ["accepted", "suppressed"],
    ["accepted", "resolved"],
    ["suppressed", "open"],
    ["suppressed", "resolved"],
    ["resolved", "open"],
  ])("allows %p -> %p", (from, to) => {
    expect(
      canTransition(from as FindingStatus, to as FindingStatus),
    ).toBe(true);
  });

  it.each([
    ["open", "open"],
    ["accepted", "accepted"],
    ["suppressed", "accepted"],
    ["suppressed", "suppressed"],
    ["resolved", "accepted"],
    ["resolved", "suppressed"],
    ["resolved", "resolved"],
  ])("refuses %p -> %p", (from, to) => {
    expect(
      canTransition(from as FindingStatus, to as FindingStatus),
    ).toBe(false);
  });
});

describe("transitionStatus", () => {
  it("returns the target status for a legal transition", () => {
    expect(unwrap(transitionStatus("open", "suppressed"))).toBe("suppressed");
  });

  it("refuses an illegal transition by naming it", () => {
    expect(unwrapErr(transitionStatus("resolved", "suppressed"))).toEqual(
      new InvalidFindingTransitionError(
        'cannot transition finding from "resolved" to "suppressed".',
      ),
    );
  });

  it("refuses a no-op transition as already-there", () => {
    expect(unwrapErr(transitionStatus("open", "open"))).toEqual(
      new InvalidFindingTransitionError('finding is already "open".'),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidFindingTransitionError("boom").name).toBe(
      "InvalidFindingTransitionError",
    );
  });
});
