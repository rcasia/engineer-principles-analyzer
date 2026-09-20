import { describe, expect, it } from "bun:test";
import { TelemetryContainsSensitiveDataError } from "../../compliance/domain/sensitive-data.ts";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  InvalidEvaluationSnapshotError,
  publishSnapshot,
  type EvaluationSnapshotProps,
  type RuleLanguageQuality,
} from "./evaluation-snapshot.ts";

function entry(
  overrides?: Partial<RuleLanguageQuality>,
): RuleLanguageQuality {
  return {
    ruleId: "srp",
    language: "typescript",
    precision: 0.8,
    recall: 0.75,
    falsePositiveRate: 0.2,
    falseNegativeRate: 0.25,
    meanConfidence: 0.82,
    calibrationGap: 0.02,
    evidenceCoverage: 0.9,
    sampleSize: 200,
    ...overrides,
  };
}

function props(
  overrides?: Partial<EvaluationSnapshotProps>,
): EvaluationSnapshotProps {
  return {
    principledVersion: "1.4.0",
    ruleVersions: { srp: "3" },
    corpusVersion: "solid-corpus-7",
    evaluatedAt: "2026-09-20",
    methodology: "Stratified sample of 200 files per rule-language pair.",
    entries: [entry()],
    limitations: ["Heuristic rules underperform on generated code."],
    ...overrides,
  };
}

describe("publishSnapshot", () => {
  it("publishes a versioned, dated snapshot with per-rule quality", () => {
    const snapshot = unwrap(publishSnapshot(props()));

    expect(snapshot.principledVersion).toBe("1.4.0");
    expect(snapshot.ruleVersions).toEqual({ srp: "3" });
    expect(snapshot.corpusVersion).toBe("solid-corpus-7");
    expect(snapshot.evaluatedAt).toBe("2026-09-20");
    expect(snapshot.methodology).toBe(
      "Stratified sample of 200 files per rule-language pair.",
    );
    expect(snapshot.entries).toEqual([entry()]);
    expect(snapshot.limitations).toEqual([
      "Heuristic rules underperform on generated code.",
    ]);
  });

  it("never collapses quality into a single opaque score", () => {
    const snapshot = unwrap(publishSnapshot(props()));

    expect("overallScore" in snapshot).toBe(false);
    expect("score" in snapshot).toBe(false);
  });

  it("keeps an optional model configuration when one contributed", () => {
    const snapshot = unwrap(
      publishSnapshot(
        props({ modelConfiguration: "jev-noul-2026-09, temperature 0" }),
      ),
    );

    expect(snapshot.modelConfiguration).toBe("jev-noul-2026-09, temperature 0");
  });

  it("accepts unknown rates as null, not as invented numbers", () => {
    const snapshot = unwrap(
      publishSnapshot(
        props({
          entries: [
            entry({
              precision: null,
              recall: null,
              falsePositiveRate: null,
              falseNegativeRate: null,
              meanConfidence: null,
              calibrationGap: null,
            }),
          ],
        }),
      ),
    );

    expect(snapshot.entries[0]?.precision).toBeNull();
    expect(snapshot.entries[0]?.calibrationGap).toBeNull();
  });

  it("rejects a calibration gap without both sides behind it", () => {
    const result = publishSnapshot(
      props({ entries: [entry({ precision: null })] }),
    );

    expect(result.ok).toBe(false);
    expect(unwrapErr(result).message).toBe(
      "entries[0].calibrationGap requires precision and meanConfidence.",
    );
  });

  it.each([
    ["principledVersion", "principledVersion must not be empty."],
    ["corpusVersion", "corpusVersion must not be empty."],
    ["methodology", "methodology must not be empty."],
  ])("rejects an empty %s", (field, message) => {
    const result = publishSnapshot(props({ [field]: "  " }) as EvaluationSnapshotProps);

    expect(unwrapErr(result).message).toBe(message);
    expect(unwrapErr(result)).toBeInstanceOf(InvalidEvaluationSnapshotError);
  });

  it.each(["2026-9-20", "20-09-2026", "not-a-date", "2026/09/20", ""])(
    "rejects %p, which is not a YYYY-MM-DD date",
    (evaluatedAt) => {
      expect(
        unwrapErr(publishSnapshot(props({ evaluatedAt }))).message,
      ).toBe("evaluatedAt must be a YYYY-MM-DD date.");
    },
  );

  it("rejects an empty entry list", () => {
    expect(unwrapErr(publishSnapshot(props({ entries: [] }))).message).toBe(
      "entries must contain at least one rule-language result.",
    );
  });

  it("rejects missing limitations", () => {
    expect(
      unwrapErr(publishSnapshot(props({ limitations: [] }))).message,
    ).toBe("limitations must state at least one known limitation.");
    expect(
      unwrapErr(publishSnapshot(props({ limitations: ["  "] }))).message,
    ).toBe("limitations must state at least one known limitation.");
  });

  it("rejects an entry with a blank rule id", () => {
    expect(
      unwrapErr(publishSnapshot(props({ entries: [entry({ ruleId: "" })] })))
        .message,
    ).toBe("entries[0].ruleId must not be empty.");
  });

  it("rejects an out-of-range rate", () => {
    expect(
      unwrapErr(
        publishSnapshot(props({ entries: [entry({ precision: 1.2 })] })),
      ).message,
    ).toBe("entries[0].precision must be between 0 and 1, or null.");
    expect(
      unwrapErr(
        publishSnapshot(props({ entries: [entry({ recall: Number.NaN })] })),
      ).message,
    ).toBe("entries[0].recall must be between 0 and 1, or null.");
  });

  it("rejects out-of-range evidence coverage", () => {
    expect(
      unwrapErr(
        publishSnapshot(props({ entries: [entry({ evidenceCoverage: -0.1 })] })),
      ).message,
    ).toBe("entries[0].evidenceCoverage must be between 0 and 1.");
  });

  it.each([0, -3, 2.5])("rejects a sample size of %p", (sampleSize) => {
    expect(
      unwrapErr(
        publishSnapshot(props({ entries: [entry({ sampleSize })] })),
      ).message,
    ).toBe("entries[0].sampleSize must be a positive integer.");
  });

  it("refuses to publish customer source smuggled in the methodology", () => {
    const smuggled = props({
      methodology: "Sampled from production traffic.",
      entries: [
        {
          ...entry(),
          ruleId: "srp",
        } as RuleLanguageQuality,
      ],
    }) as unknown as Record<string, unknown>;
    smuggled.sourceCode = "const leaked = true;";

    expect(() =>
      publishSnapshot(smuggled as unknown as EvaluationSnapshotProps),
    ).toThrow(
      new TelemetryContainsSensitiveDataError(["sourceCode"]),
    );
  });

  it("hands out copies so later edits cannot rewrite history", () => {
    const input = props();
    const snapshot = unwrap(publishSnapshot(input));
    (input.ruleVersions as Record<string, string>).srp = "rewritten";
    (input.entries[0] as { precision: number | null }).precision = 1;
    (input.limitations as string[]).push("rewritten");

    expect(snapshot.ruleVersions).toEqual({ srp: "3" });
    expect(snapshot.entries[0]?.precision).toBe(0.8);
    expect(snapshot.limitations).toEqual([
      "Heuristic rules underperform on generated code.",
    ]);
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidEvaluationSnapshotError("boom").name).toBe(
      "InvalidEvaluationSnapshotError",
    );
  });
});
