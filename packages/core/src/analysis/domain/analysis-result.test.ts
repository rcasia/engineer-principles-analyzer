import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import type { AnalysisMethod } from "./analysis-method.ts";
import {
  AnalysisResult,
  InvalidAnalysisResultError,
} from "./analysis-result.ts";
import type { AnalysisResultProps } from "./analysis-result.ts";
import type { AnalysisStatus } from "./analysis-status.ts";
import { Confidence } from "./confidence.ts";
import { Evidence } from "./evidence.ts";
import { SourceLocation } from "./source-location.ts";

const location = unwrap(
  SourceLocation.of({ filePath: "src/a.ts", startLine: 12 }),
);
const evidence = [unwrap(Evidence.of({ location, excerpt: "class Foo {}" }))];
const analyzer = { name: "principled-core", version: "0.0.0" };

const validProps: AnalysisResultProps = {
  ruleId: "solid.srp",
  status: "compliant",
  confidence: unwrap(Confidence.of(1)),
  method: "deterministic",
  evidence: [],
  explanation: "The class has a single responsibility.",
  language: "typescript",
  analyzer,
  humanReviewRecommended: false,
};

describe("AnalysisResult", () => {
  it("constructs with the exact fields it was given", () => {
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        remediation: "Extract the second responsibility into its own class.",
        limitations: ["Limited to a single file of context."],
        evaluationMetadata: { corpus: "solid-v1" },
      }),
    );

    expect(result.ruleId).toBe("solid.srp");
    expect(result.status).toBe("compliant");
    expect(result.confidence.equals(unwrap(Confidence.of(1)))).toBe(true);
    expect(result.method).toBe("deterministic");
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      "The class has a single responsibility.",
    );
    expect(result.remediation).toBe(
      "Extract the second responsibility into its own class.",
    );
    expect(result.language).toBe("typescript");
    expect(result.analyzer).toEqual(analyzer);
    expect(result.limitations).toEqual([
      "Limited to a single file of context.",
    ]);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evaluationMetadata).toEqual({ corpus: "solid-v1" });
  });

  it("leaves remediation undefined when omitted", () => {
    expect(unwrap(AnalysisResult.of(validProps)).remediation).toBeUndefined();
  });

  it("defaults limitations to an empty array when omitted", () => {
    expect(unwrap(AnalysisResult.of(validProps)).limitations).toEqual([]);
  });

  it("leaves evaluationMetadata undefined when omitted", () => {
    expect(
      unwrap(AnalysisResult.of(validProps)).evaluationMetadata,
    ).toBeUndefined();
  });

  it("copies the evidence array so later caller mutations cannot leak in", () => {
    const seed = [
      unwrap(Evidence.of({ location, excerpt: "class Foo { bar() {} }" })),
    ];
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        status: "violation",
        confidence: unwrap(Confidence.of(1)),
        evidence: seed,
      }),
    );

    seed.push(
      unwrap(Evidence.of({ location, excerpt: "class Foo { baz() {} }" })),
    );

    expect(result.evidence).toHaveLength(1);
  });

  it("copies the limitations array so later caller mutations cannot leak in", () => {
    const seed = ["Limited to a single file of context."];
    const result = unwrap(
      AnalysisResult.of({ ...validProps, limitations: seed }),
    );

    seed.push("Another limitation.");

    expect(result.limitations).toEqual([
      "Limited to a single file of context.",
    ]);
  });

  it("copies evaluationMetadata so later caller mutations cannot leak in", () => {
    const seed: Record<string, string> = { corpus: "solid-v1" };
    const result = unwrap(
      AnalysisResult.of({ ...validProps, evaluationMetadata: seed }),
    );

    seed.corpus = "solid-v2";

    expect(result.evaluationMetadata).toEqual({ corpus: "solid-v1" });
  });

  it.each(["", "   "])(
    "rejects %p as ruleId, as an error value rather than a throw",
    (ruleId) => {
      expect(unwrapErr(AnalysisResult.of({ ...validProps, ruleId }))).toEqual(
        new InvalidAnalysisResultError("ruleId must not be empty."),
      );
    },
  );

  it("rejects a status the contract does not define, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        AnalysisResult.of({
          ...validProps,
          status: "passing" as unknown as AnalysisStatus,
        }),
      ),
    ).toEqual(
      new InvalidAnalysisResultError(
        'status must be a known AnalysisStatus, got "passing".',
      ),
    );
  });

  it("rejects a method the contract does not define, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        AnalysisResult.of({
          ...validProps,
          method: "guess" as unknown as AnalysisMethod,
        }),
      ),
    ).toEqual(
      new InvalidAnalysisResultError(
        'method must be a known AnalysisMethod, got "guess".',
      ),
    );
  });

  it.each(["", "   "])(
    "rejects %p as explanation, as an error value rather than a throw",
    (explanation) => {
      expect(
        unwrapErr(AnalysisResult.of({ ...validProps, explanation })),
      ).toEqual(
        new InvalidAnalysisResultError("explanation must not be empty."),
      );
    },
  );

  it.each(["", "   "])(
    "rejects %p as language, as an error value rather than a throw",
    (language) => {
      expect(
        unwrapErr(AnalysisResult.of({ ...validProps, language })),
      ).toEqual(
        new InvalidAnalysisResultError("language must not be empty."),
      );
    },
  );

  it.each(["", "   "])(
    "rejects %p as analyzer.name, as an error value rather than a throw",
    (name) => {
      expect(
        unwrapErr(
          AnalysisResult.of({
            ...validProps,
            analyzer: { ...analyzer, name },
          }),
        ),
      ).toEqual(
        new InvalidAnalysisResultError("analyzer.name must not be empty."),
      );
    },
  );

  it.each(["", "   "])(
    "rejects %p as analyzer.version, as an error value rather than a throw",
    (version) => {
      expect(
        unwrapErr(
          AnalysisResult.of({
            ...validProps,
            analyzer: { ...analyzer, version },
          }),
        ),
      ).toEqual(
        new InvalidAnalysisResultError(
          "analyzer.version must not be empty.",
        ),
      );
    },
  );

  it("rejects a deterministic result with less than maximum confidence, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        AnalysisResult.of({
          ...validProps,
          method: "deterministic",
          confidence: unwrap(Confidence.of(0.99)),
        }),
      ),
    ).toEqual(
      new InvalidAnalysisResultError(
        "A deterministic result must report maximum confidence.",
      ),
    );
  });

  it("accepts a deterministic result with exactly maximum confidence", () => {
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        method: "deterministic",
        confidence: unwrap(Confidence.of(1)),
      }),
    );

    expect(result.confidence.equals(unwrap(Confidence.of(1)))).toBe(true);
  });

  it("accepts an ai_assisted result with less than maximum confidence", () => {
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        method: "ai_assisted",
        confidence: unwrap(Confidence.of(0.6)),
      }),
    );

    expect(result.confidence.equals(unwrap(Confidence.of(0.6)))).toBe(true);
  });

  it("rejects a violation with no evidence, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        AnalysisResult.of({
          ...validProps,
          status: "violation",
          evidence: [],
        }),
      ),
    ).toEqual(
      new InvalidAnalysisResultError(
        "A violation must be backed by at least one piece of evidence.",
      ),
    );
  });

  it("accepts a violation with at least one piece of evidence", () => {
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        status: "violation",
        evidence,
      }),
    );

    expect(result.status).toBe("violation");
    expect(result.evidence).toHaveLength(1);
  });

  it("rejects an uncertain status that does not recommend human review, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        AnalysisResult.of({
          ...validProps,
          status: "uncertain",
          method: "ai_assisted",
          confidence: unwrap(Confidence.of(0.4)),
          humanReviewRecommended: false,
        }),
      ),
    ).toEqual(
      new InvalidAnalysisResultError(
        "An uncertain result must recommend human review.",
      ),
    );
  });

  it("accepts an uncertain status that recommends human review", () => {
    const result = unwrap(
      AnalysisResult.of({
        ...validProps,
        status: "uncertain",
        method: "ai_assisted",
        confidence: unwrap(Confidence.of(0.4)),
        humanReviewRecommended: true,
      }),
    );

    expect(result.status).toBe("uncertain");
    expect(result.humanReviewRecommended).toBe(true);
  });

  it("names its error so callers can discriminate it", () => {
    expect(
      unwrapErr(AnalysisResult.of({ ...validProps, ruleId: "" })),
    ).toBeInstanceOf(InvalidAnalysisResultError);
    expect(new InvalidAnalysisResultError("boom").name).toBe(
      "InvalidAnalysisResultError",
    );
  });
});
