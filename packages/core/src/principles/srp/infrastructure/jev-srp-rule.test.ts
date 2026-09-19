import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { AnalyzeSubject } from "../../../engine/application/analyze-subject.use-case.ts";
import { InMemoryRuleCatalog } from "../../../engine/infrastructure/in-memory-rule-catalog.ts";
import { InMemoryJevClient } from "../../../jev/infrastructure/in-memory-jev-client.ts";
import { JEV_SRP_RULE_ID, JevSrpRule } from "./jev-srp-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

function ruleFor(value: number, model = "jev-1.13.0") {
  return new JevSrpRule(new InMemoryJevClient([{ value, model }]));
}

function idSequence(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

const LIMITATIONS = [
  "Jev returns a single calibrated probability with no source locations: violation evidence points at the subject's first non-empty line, not at the offending code.",
  "The violation/compliant cutoffs (0.75/0.25) are starting defaults, not measured thresholds: tune them against the versioned corpus (#27) before trusting the boundary.",
  "AI judgments are non-deterministic: the same subject can receive different verdicts across runs or model versions. evaluationMetadata.jevModel records which model answered.",
];

describe("JevSrpRule", () => {
  test("has the stable rule id solid.srp.jev, distinct from the heuristic", () => {
    expect(new JevSrpRule(new InMemoryJevClient()).id).toBe(JEV_SRP_RULE_ID);
    expect(JEV_SRP_RULE_ID).toBe("solid.srp.jev");
    expect(JEV_SRP_RULE_ID).not.toBe("solid.srp");
  });

  test("asks Jev one Noul question over the source and language only", async () => {
    const client = new InMemoryJevClient([{ value: 0.5, model: "jev-1.13.0" }]);
    const source = "class UserManager {\n  save() {}\n}";

    await new JevSrpRule(client).evaluate(subjectOf(source, "javascript"));

    expect(client.calls).toEqual([
      {
        state: { sourceCode: source, language: "javascript" },
        question: {
          instructions:
            "Does this source code concentrate multiple unrelated responsibilities in one place, in violation of the Single Responsibility Principle?",
          criteria: {
            true: "One class or module does work from two or more of these areas: persistence, communication, presentation, validation, calculation, authentication, serialization, logging.",
            false: "Every class or module has a single coherent responsibility.",
          },
        },
      },
    ]);
  });

  test("reports a violation for a high Noul, with evidence and remediation", async () => {
    const result = await ruleFor(0.75).evaluate(
      subjectOf("\nclass UserManager {\n  save() {}\n}"),
    );

    expect(result.ruleId).toBe("solid.srp.jev");
    expect(result.status).toBe("violation");
    expect(result.method).toBe("ai_assisted");
    expect(result.confidence.value).toBe(0.5);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      "Jev judged this subject likely to violate the Single Responsibility Principle (noul=0.75). The model found evidence of concentrated responsibility.",
    );
    expect(result.remediation).toBe(
      "Consider splitting responsibilities: name each distinct responsibility in the subject, then extract each one into its own collaborator, one at a time.",
    );
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.location.startLine).toBe(2);
    expect(result.evidence[0]?.location.endLine).toBe(2);
    expect(result.evidence[0]?.excerpt).toBe("class UserManager {");
    expect(result.limitations).toEqual(LIMITATIONS);
    expect(result.evaluationMetadata).toEqual({ jevModel: "jev-1.13.0" });
  });

  test("reports uncertain for a middle Noul, without evidence or remediation", async () => {
    const result = await ruleFor(0.5).evaluate(subjectOf("class Foo {}"));

    expect(result.status).toBe("uncertain");
    expect(result.method).toBe("ai_assisted");
    expect(result.confidence.value).toBe(0);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      "Jev could not confidently confirm or rule out a single-responsibility violation (noul=0.5). The model's probability fell between the violation and compliant cutoffs.",
    );
    expect(result.remediation).toBeUndefined();
    expect(result.evidence).toEqual([]);
    expect(result.limitations).toEqual(LIMITATIONS);
    expect(result.evaluationMetadata).toEqual({ jevModel: "jev-1.13.0" });
  });

  test("reports compliant for a low Noul, still recommending human review", async () => {
    const result = await ruleFor(0.25).evaluate(subjectOf("class Foo {}"));

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("ai_assisted");
    expect(result.confidence.value).toBe(0.5);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      "Jev found no sign of a single-responsibility violation (noul=0.25). The model judged each class or module to have a single coherent responsibility.",
    );
    expect(result.remediation).toBeUndefined();
    expect(result.evidence).toEqual([]);
    expect(result.limitations).toEqual(LIMITATIONS);
  });

  test("always reports the language it was given", async () => {
    const result = await ruleFor(0.1).evaluate(
      subjectOf("class Foo {}", "javascript"),
    );

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer with version 1", async () => {
    const result = await ruleFor(0.5).evaluate(subjectOf("class Foo {}"));

    expect(result.analyzer).toEqual({
      name: "principled-solid-srp-jev",
      version: "1",
    });
  });

  test("records the answering model for snapshot attribution", async () => {
    const result = await ruleFor(0.5, "jev-1.12.0").evaluate(
      subjectOf("class Foo {}"),
    );

    expect(result.evaluationMetadata).toEqual({ jevModel: "jev-1.12.0" });
  });

  test("lets transport failures throw so the engine isolates them as unable_to_analyze", async () => {
    const client = new InMemoryJevClient([]);
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([new JevSrpRule(client)]),
      { generateId: idSequence("test") },
    );

    const run = await engine.execute({ subject: subjectOf("class Foo {}") });

    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.ruleId).toBe("solid.srp.jev");
    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.results[0]?.explanation).toContain(
      "InMemoryJevClient has no more scripted judgments.",
    );
    expect(run.events).toHaveLength(2);
    expect(run.events[1]?.eventType).toBe("AnalysisFailed");
  });

  test("validates the core engine end to end with an AI verdict", async () => {
    const engine = new AnalyzeSubject(
      new InMemoryRuleCatalog([ruleFor(0.9)]),
      { generateId: idSequence("test") },
    );

    const run = await engine.execute({ subject: subjectOf("class Foo {}") });

    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.ruleId).toBe("solid.srp.jev");
    expect(run.results[0]?.status).toBe("violation");
    expect(run.results[0]?.method).toBe("ai_assisted");
    expect(run.events).toHaveLength(2);
    expect(run.events[0]?.eventType).toBe("AnalysisRequested");
    expect(run.events[1]?.eventType).toBe("AnalysisCompleted");
  });
});
