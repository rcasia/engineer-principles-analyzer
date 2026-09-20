import { describe, expect, it } from "bun:test";
import { rehydrate } from "../../eventsourcing/domain/rehydrate.ts";
import {
  FINDING_ACCEPTED_EVENT,
  FINDING_DETECTED_EVENT,
  FINDING_REOPENED_EVENT,
  FINDING_RESOLVED_EVENT,
  FINDING_SUPPRESSED_EVENT,
} from "../domain/finding-event.ts";
import {
  FindingLifecycleDecider,
  INITIAL_FINDING_STATE,
  InvalidFindingCommandError,
} from "./finding-lifecycle.decider.ts";

const decider = new FindingLifecycleDecider();

function detect() {
  return decider.decide(
    {
      kind: "detect",
      findingId: "finding-1",
      ruleId: "acme.no-console",
      ruleVersion: "1.2.0",
      filePath: "src/a.ts",
      startLine: 3,
      findingHash: "hash-abc",
    },
    INITIAL_FINDING_STATE,
  );
}

describe("FindingLifecycleDecider", () => {
  it("starts from a nonexistent state", () => {
    expect(decider.initialState).toEqual(INITIAL_FINDING_STATE);
    expect(INITIAL_FINDING_STATE.status).toBe("nonexistent");
  });

  it("detects a finding with references and no source", () => {
    expect(detect()).toEqual([
      {
        eventType: FINDING_DETECTED_EVENT,
        payload: {
          findingId: "finding-1",
          ruleId: "acme.no-console",
          ruleVersion: "1.2.0",
          filePath: "src/a.ts",
          startLine: 3,
          findingHash: "hash-abc",
        },
      },
    ]);
  });

  it("refuses to detect the same finding twice", () => {
    const state = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);

    expect(() =>
      decider.decide(
        {
          kind: "detect",
          findingId: "finding-1",
          ruleId: "acme.no-console",
          findingHash: "hash-abc",
        },
        state,
      ),
    ).toThrow(new InvalidFindingCommandError('finding "finding-1" already exists.'));
  });

  it.each([
    [{ findingId: "  " }, "findingId must not be empty."],
    [{ ruleId: "  " }, "ruleId must not be empty."],
    [{ findingHash: "" }, "findingHash must not be empty."],
  ])("rejects detection with %p", (override, message) => {
    expect(() =>
      decider.decide(
        {
          kind: "detect",
          findingId: "finding-1",
          ruleId: "acme.no-console",
          findingHash: "hash-abc",
          ...override,
        },
        INITIAL_FINDING_STATE,
      ),
    ).toThrow(new InvalidFindingCommandError(message));
  });

  it("walks the full lifecycle open -> suppressed -> open -> resolved", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);
    expect(detected.status).toBe("open");

    const [suppressed] = decider.decide(
      { kind: "suppress", reason: "false positive", suppressedBy: "ana" },
      detected,
    );
    expect(suppressed).toEqual({
      eventType: FINDING_SUPPRESSED_EVENT,
      payload: {
        findingId: "finding-1",
        reason: "false positive",
        suppressedBy: "ana",
        expiresAt: undefined,
      },
    });
    const suppressedState = decider.evolve(detected, suppressed!);
    expect(suppressedState.status).toBe("suppressed");
    expect(suppressedState.suppression?.reason).toBe("false positive");

    const [reopened] = decider.decide({ kind: "reopen", reason: "regressed" }, suppressedState);
    expect(reopened?.eventType).toBe(FINDING_REOPENED_EVENT);
    const reopenedState = decider.evolve(suppressedState, reopened!);
    expect(reopenedState.status).toBe("open");
    expect(reopenedState.suppression).toBeUndefined();

    const [resolved] = decider.decide(
      { kind: "resolve", reason: "fixed", resolvedBy: "ana" },
      reopenedState,
    );
    expect(resolved).toEqual({
      eventType: FINDING_RESOLVED_EVENT,
      payload: { findingId: "finding-1", reason: "fixed", resolvedBy: "ana" },
    });
    expect(decider.evolve(reopenedState, resolved!).status).toBe("resolved");
  });

  it("accepts an open finding", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);

    const [accepted] = decider.decide(
      { kind: "accept", reason: "confirmed", acceptedBy: "bo" },
      detected,
    );

    expect(accepted).toEqual({
      eventType: FINDING_ACCEPTED_EVENT,
      payload: { findingId: "finding-1", reason: "confirmed", acceptedBy: "bo" },
    });
    expect(decider.evolve(detected, accepted!).status).toBe("accepted");
  });

  it("refuses suppression without a reason", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);

    expect(() =>
      decider.decide({ kind: "suppress", reason: "   " }, detected),
    ).toThrow(
      new InvalidFindingCommandError("suppression reason must not be empty."),
    );
  });

  it("refuses transitions the lifecycle does not allow", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);

    expect(() => decider.decide({ kind: "reopen" }, detected)).toThrow(
      new InvalidFindingCommandError('cannot reopening a finding that is "open".'),
    );
    expect(() => decider.decide({ kind: "accept" }, INITIAL_FINDING_STATE)).toThrow(
      new InvalidFindingCommandError('cannot accepting a finding that is "nonexistent".'),
    );
    expect(() => decider.decide({ kind: "resolve" }, INITIAL_FINDING_STATE)).toThrow(
      new InvalidFindingCommandError('cannot resolving a finding that is "nonexistent".'),
    );
    expect(() => decider.decide({ kind: "suppress", reason: "x" }, INITIAL_FINDING_STATE)).toThrow(
      new InvalidFindingCommandError('cannot suppressing a finding that is "nonexistent".'),
    );
  });

  it("rehydrates state from history: lifecycle state is reconstructed from events", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);
    const [accepted] = decider.decide({ kind: "accept" }, detected);
    const history = [detect()[0]!, accepted!];

    const rebuilt = rehydrate(INITIAL_FINDING_STATE, history, (state, event) =>
      decider.evolve(state, event),
    );

    expect(rebuilt).toEqual({
      status: "accepted",
      findingId: "finding-1",
      ruleId: "acme.no-console",
      ruleVersion: "1.2.0",
      suppression: undefined,
    });
  });

  it("ignores unknown events when evolving", () => {
    const detected = decider.evolve(INITIAL_FINDING_STATE, detect()[0]!);

    expect(
      decider.evolve(detected, { eventType: "SomethingElse", payload: {} as never }),
    ).toBe(detected);
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidFindingCommandError("boom").name).toBe(
      "InvalidFindingCommandError",
    );
  });
});
