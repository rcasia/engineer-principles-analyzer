import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  EXEMPLAR_CATEGORIES,
  InvalidExemplarError,
  requestCorrection,
  requestPublication,
  requestRemoval,
  type ExemplarSubmission,
} from "./exemplar.ts";

function submission(
  overrides?: Partial<ExemplarSubmission>,
): ExemplarSubmission {
  return {
    title: "A focused order pipeline",
    category: "exemplary-srp",
    ruleId: "srp",
    language: "typescript",
    sourceRef: "https://example.com/org/repo/blob/v2/src/pipeline.ts",
    owner: "example-org",
    license: "Apache-2.0",
    methodology: "evaluation-snapshot solid-corpus-7, human review confirmed",
    analysisVersion: "principled 1.4.0, rule srp 3",
    ownerConsent: true,
    evidence: ["Each stage owns one transformation step."],
    limitations: ["Single-file view; cross-file callers not assessed."],
    ...overrides,
  };
}

describe("requestPublication", () => {
  it("lists the educational categories and nothing else", () => {
    expect([...EXEMPLAR_CATEGORIES]).toEqual([
      "exemplary-srp",
      "exemplary-ocp",
      "exemplary-lsp",
      "exemplary-isp",
      "exemplary-dip",
      "instructive-violation",
      "ambiguous-case",
      "refactoring-improvement",
    ]);
  });

  it("publishes an owner-consented entry with its full context", () => {
    const published = unwrap(requestPublication(submission()));

    expect(published.status).toBe("published");
    expect(published.methodology).toBe(
      "evaluation-snapshot solid-corpus-7, human review confirmed",
    );
    expect(published.analysisVersion).toBe("principled 1.4.0, rule srp 3");
    expect(published.evidence).toEqual([
      "Each stage owns one transformation step.",
    ]);
    expect(published.limitations).toEqual([
      "Single-file view; cross-file callers not assessed.",
    ]);
  });

  it("never ranks or identifies individual developers", () => {
    const published = unwrap(requestPublication(submission()));

    expect("developer" in published).toBe(false);
    expect("developerId" in published).toBe(false);
    expect("author" in published).toBe(false);
    expect("rank" in published).toBe(false);
    expect("score" in published).toBe(false);
  });

  it("refuses publication without explicit owner opt-in", () => {
    expect(
      unwrapErr(requestPublication(submission({ ownerConsent: false })))
        .message,
    ).toBe("ownerConsent must be an explicit opt-in to publish.");
  });

  it("rejects an unknown category", () => {
    const result = requestPublication(
      submission({ category: "worst-code-ever" as never }),
    );

    expect(unwrapErr(result).message).toBe(
      "category must be one of exemplary-srp, exemplary-ocp, exemplary-lsp, exemplary-isp, exemplary-dip, instructive-violation, ambiguous-case, refactoring-improvement.",
    );
  });

  it.each([
    "title",
    "ruleId",
    "language",
    "sourceRef",
    "owner",
    "license",
    "methodology",
    "analysisVersion",
  ])("rejects an empty %s", (field) => {
    const result = requestPublication(
      submission({ [field]: "  " }) as ExemplarSubmission,
    );

    expect(unwrapErr(result).message).toBe(`${field} must not be empty.`);
    expect(unwrapErr(result)).toBeInstanceOf(InvalidExemplarError);
  });

  it("rejects missing evidence and limitations", () => {
    expect(
      unwrapErr(requestPublication(submission({ evidence: [] }))).message,
    ).toBe("evidence must state at least one finding description.");
    expect(
      unwrapErr(requestPublication(submission({ evidence: ["  "] }))).message,
    ).toBe("evidence must state at least one finding description.");
    expect(
      unwrapErr(requestPublication(submission({ limitations: [] }))).message,
    ).toBe("limitations must state at least one known limitation.");
  });

  it("holds no raw source, only a permalink to public code", () => {
    const published = unwrap(requestPublication(submission()));

    expect("sourceCode" in published).toBe(false);
    expect(published.sourceRef).toBe(
      "https://example.com/org/repo/blob/v2/src/pipeline.ts",
    );
  });
});

describe("requestCorrection", () => {
  it("records the owner's correction request with its note", () => {
    const corrected = unwrap(
      requestCorrection(
        unwrap(requestPublication(submission())),
        "The permalink moved to the v3 tag.",
      ),
    );

    expect(corrected.status).toBe("correction-requested");
    expect(corrected.correctionNote).toBe("The permalink moved to the v3 tag.");
  });

  it("rejects an empty correction note", () => {
    expect(
      unwrapErr(
        requestCorrection(unwrap(requestPublication(submission())), "  "),
      ).message,
    ).toBe("correction note must not be empty.");
  });

  it("keeps removed entries removed", () => {
    const removed = unwrap(
      requestRemoval(unwrap(requestPublication(submission()))),
    );

    expect(
      unwrapErr(requestCorrection(removed, "please fix")).message,
    ).toBe("removed entries cannot be corrected; they stay removed.");
  });
});

describe("requestRemoval", () => {
  it("honours the owner's removal request and drops the note", () => {
    const corrected = unwrap(
      requestCorrection(
        unwrap(requestPublication(submission())),
        "The permalink moved.",
      ),
    );
    const removed = unwrap(requestRemoval(corrected));

    expect(removed.status).toBe("removed");
    expect("correctionNote" in removed).toBe(false);
  });

  it("rejects removing what is already removed", () => {
    const removed = unwrap(
      requestRemoval(unwrap(requestPublication(submission()))),
    );

    expect(unwrapErr(requestRemoval(removed)).message).toBe(
      "entry is already removed.",
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidExemplarError("boom").name).toBe("InvalidExemplarError");
  });
});
