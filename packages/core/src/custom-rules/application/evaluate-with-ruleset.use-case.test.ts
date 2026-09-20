import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import { Subject } from "../../engine/domain/subject.ts";
import { unwrap } from "../../shared/result.ts";
import {
  CUSTOM_RULE_COMPLETED_EVENT,
  CUSTOM_RULE_FAILED_EVENT,
} from "../domain/custom-rule-event.ts";
import { Ruleset } from "../domain/ruleset.ts";
import type { VersionedRule } from "./versioned-rule.port.ts";
import { EvaluateWithRuleset } from "./evaluate-with-ruleset.use-case.ts";
import {
  customRuleEntry,
  InMemoryCustomRuleCatalog,
} from "../infrastructure/in-memory-custom-rule-catalog.ts";

function subject(): Subject {
  return unwrap(Subject.of({ sourceCode: "const x = 1;", language: "typescript" }));
}

function compliant(ruleId: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId,
      status: "compliant",
      confidence: unwrap(Confidence.of(0.5)),
      method: "heuristic",
      evidence: [],
      explanation: "All good.",
      language: "typescript",
      analyzer: { name: "test-custom", version: "1.2.0" },
      humanReviewRecommended: false,
    }),
  );
}

const firstRule: VersionedRule = {
  id: "acme.first",
  version: "1.0.0",
  author: "acme",
  evaluate: () => Promise.resolve(compliant("acme.first")),
};

const throwingRule: VersionedRule = {
  id: "acme.throwing",
  version: "2.0.0",
  author: "acme",
  evaluate: () => Promise.reject(new Error("custom boom")),
};

function ruleset(): Ruleset {
  return unwrap(
    Ruleset.of({
      id: "acme.backend",
      version: "3.0.0",
      rules: [
        { ruleId: "acme.first", version: "1.0.0" },
        { ruleId: "acme.throwing", version: "2.0.0" },
      ],
    }),
  );
}

function catalog(): InMemoryCustomRuleCatalog {
  return new InMemoryCustomRuleCatalog([
    customRuleEntry({
      id: "acme.first",
      version: "1.0.0",
      author: "acme",
      status: "active",
      evaluate: firstRule.evaluate,
    }),
    customRuleEntry({
      id: "acme.throwing",
      version: "2.0.0",
      author: "acme",
      status: "active",
      evaluate: throwingRule.evaluate,
    }),
  ]);
}

function sequentialIds(): { readonly generateId: () => string } {
  let next = 1;
  return { generateId: () => `id-${next++}` };
}

describe("custom rule event names", () => {
  it("keeps the stable CustomRule* names the use-case emits", () => {
    expect(CUSTOM_RULE_COMPLETED_EVENT).toBe("CustomRuleCompleted");
    expect(CUSTOM_RULE_FAILED_EVENT).toBe("CustomRuleFailed");
  });
});

describe("EvaluateWithRuleset", () => {
  it("generates its own event ids when none are injected", async () => {
    const useCase = new EvaluateWithRuleset(catalog());

    const evaluation = await useCase.execute({
      subject: subject(),
      ruleset: ruleset(),
      ruleIds: ["acme.first"],
    });

    expect(evaluation.results[0]?.status).toBe("compliant");
    expect(evaluation.events[0]?.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("resolves the rule whose id and version both match, not version alone", async () => {
    const sameVersion: VersionedRule = {
      id: "acme.second",
      version: "1.0.0",
      author: "acme",
      evaluate: () =>
        Promise.resolve(
          unwrap(
            AnalysisResult.of({
              ruleId: "acme.second",
              status: "violation",
              confidence: unwrap(Confidence.of(1)),
              method: "deterministic",
              evidence: [
                unwrap(
                  Evidence.of({
                    location: unwrap(SourceLocation.of({ startLine: 1 })),
                    excerpt: "second rule fired",
                  }),
                ),
              ],
              explanation: "Second rule fired.",
              language: "typescript",
              analyzer: { name: "test-custom", version: "1.0.0" },
              humanReviewRecommended: false,
            }),
          ),
        ),
    };
    const both = new InMemoryCustomRuleCatalog([
      customRuleEntry({
        id: "acme.first",
        version: "1.0.0",
        author: "acme",
        status: "active",
        evaluate: firstRule.evaluate,
      }),
      customRuleEntry({
        id: "acme.second",
        version: "1.0.0",
        author: "acme",
        status: "active",
        evaluate: sameVersion.evaluate,
      }),
    ]);
    const pinned = unwrap(
      Ruleset.of({
        id: "acme.backend",
        version: "1.0.0",
        rules: [{ ruleId: "acme.second", version: "1.0.0" }],
      }),
    );
    const useCase = new EvaluateWithRuleset(both, sequentialIds());

    const evaluation = await useCase.execute({ subject: subject(), ruleset: pinned });

    expect(evaluation.results[0]?.ruleId).toBe("acme.second");
    expect(evaluation.results[0]?.status).toBe("violation");
  });

  it("runs every pinned rule in ruleset order with versioned events", async () => {
    const useCase = new EvaluateWithRuleset(catalog(), sequentialIds());

    const evaluation = await useCase.execute({ subject: subject(), ruleset: ruleset() });

    expect(evaluation.results.map((result) => result.status)).toEqual([
      "compliant",
      "unable_to_analyze",
    ]);
    expect(evaluation.events).toEqual([
      {
        eventId: "id-1",
        eventType: CUSTOM_RULE_COMPLETED_EVENT,
        eventVersion: 1,
        correlationId: "acme.backend",
        causationId: "acme.backend",
        payload: {
          ruleId: "acme.first",
          ruleVersion: "1.0.0",
          rulesetId: "acme.backend",
          rulesetVersion: "3.0.0",
          status: "compliant",
          method: "heuristic",
          confidence: 0.5,
        },
      },
      {
        eventId: "id-2",
        eventType: CUSTOM_RULE_FAILED_EVENT,
        eventVersion: 1,
        correlationId: "acme.backend",
        causationId: "acme.backend",
        payload: {
          ruleId: "acme.throwing",
          ruleVersion: "2.0.0",
          rulesetId: "acme.backend",
          rulesetVersion: "3.0.0",
          reason: "custom boom",
        },
      },
    ]);
  });

  it("restricts the run to selected rule ids", async () => {
    const useCase = new EvaluateWithRuleset(catalog(), sequentialIds());

    const evaluation = await useCase.execute({
      subject: subject(),
      ruleset: ruleset(),
      ruleIds: ["acme.first"],
    });

    expect(evaluation.results).toHaveLength(1);
    expect(evaluation.results[0]?.ruleId).toBe("acme.first");
    expect(evaluation.events).toHaveLength(1);
  });

  it("fails a version mismatch instead of running the wrong version", async () => {
    const drifted = unwrap(
      Ruleset.of({
        id: "acme.backend",
        version: "3.0.0",
        rules: [{ ruleId: "acme.first", version: "9.9.9" }],
      }),
    );
    const useCase = new EvaluateWithRuleset(catalog(), sequentialIds());

    const evaluation = await useCase.execute({ subject: subject(), ruleset: drifted });

    expect(evaluation.results[0]?.status).toBe("unable_to_analyze");
    expect(evaluation.events).toEqual([
      {
        eventId: "id-1",
        eventType: CUSTOM_RULE_FAILED_EVENT,
        eventVersion: 1,
        correlationId: "acme.backend",
        causationId: "acme.backend",
        payload: {
          ruleId: "acme.first",
          ruleVersion: "9.9.9",
          rulesetId: "acme.backend",
          rulesetVersion: "3.0.0",
          reason: 'No rule "acme.first" at version "9.9.9" is registered.',
        },
      },
    ]);
  });

  it("synthesizes an honest failure result, never the rule's own verdict", async () => {
    const useCase = new EvaluateWithRuleset(catalog(), sequentialIds());

    const evaluation = await useCase.execute({
      subject: subject(),
      ruleset: ruleset(),
      ruleIds: ["acme.throwing"],
    });

    expect(evaluation.results[0]?.status).toBe("unable_to_analyze");
    expect(evaluation.results[0]?.evidence).toEqual([]);
    expect(evaluation.results[0]?.explanation).toBe(
      "The ruleset engine could not obtain a verdict from this rule: custom boom",
    );
    expect(evaluation.results[0]?.limitations).toEqual([
      "Synthesized by the ruleset engine after the rule failed to run; not the rule's own judgment.",
    ]);
    expect(evaluation.results[0]?.humanReviewRecommended).toBe(true);
  });

  it("fails a rule that returns a non-result value", async () => {
    const bad = new InMemoryCustomRuleCatalog([
      customRuleEntry({
        id: "acme.bad",
        version: "1.0.0",
        author: "acme",
        status: "active",
        evaluate: (() =>
          Promise.resolve({ nope: true })) as unknown as VersionedRule["evaluate"],
      }),
    ]);
    const pinned = unwrap(
      Ruleset.of({
        id: "acme.backend",
        version: "1.0.0",
        rules: [{ ruleId: "acme.bad", version: "1.0.0" }],
      }),
    );
    const useCase = new EvaluateWithRuleset(bad, sequentialIds());

    const evaluation = await useCase.execute({ subject: subject(), ruleset: pinned });

    expect(evaluation.results[0]?.status).toBe("unable_to_analyze");
    expect(evaluation.events[0]?.payload).toEqual({
      ruleId: "acme.bad",
      ruleVersion: "1.0.0",
      rulesetId: "acme.backend",
      rulesetVersion: "1.0.0",
      reason: 'Rule "acme.bad" did not return a valid AnalysisResult.',
    });
  });

  it("carries no source in its events", async () => {
    const useCase = new EvaluateWithRuleset(catalog(), sequentialIds());

    const evaluation = await useCase.execute({
      subject: unwrap(
        Subject.of({ sourceCode: "secret-custom-source", language: "typescript" }),
      ),
      ruleset: ruleset(),
    });

    expect(JSON.stringify(evaluation.events)).not.toContain("secret-custom-source");
  });
});
