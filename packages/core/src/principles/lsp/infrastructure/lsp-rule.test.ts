import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { LSP_RULE_ID, LspRule } from "./lsp-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

const PARENT = "class Animal {\n  speak() { return '...'; }\n  fly() { return '...'; }\n}";

const rule = new LspRule();

describe("LspRule", () => {
  test("has the stable rule id solid.lsp", () => {
    expect(rule.id).toBe(LSP_RULE_ID);
    expect(rule.id).toBe("solid.lsp");
  });

  test("reports not_applicable, deterministically, for an unsupported language", async () => {
    const result = await rule.evaluate(subjectOf("class Dog extends Animal {}", "python"));

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'This rule does not yet know how to detect inheritance in "python".',
    );
  });

  test("reports not_applicable when the subject has no inheritance", async () => {
    const result = await rule.evaluate(
      subjectOf("class Point {\n  getX() { return 1; }\n}"),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      "No inheritance relationship was found to evaluate for substitutability.",
    );
  });

  test("reports compliant when overrides never throw", async () => {
    const result = await rule.evaluate(
      subjectOf(`${PARENT}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}`),
    );

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No subclass override introduced a new throw. Checked 1 subclass(es) against their local parents.",
    );
  });

  test("reports uncertain for exactly one throwing override", async () => {
    const result = await rule.evaluate(
      subjectOf(
        `${PARENT}\nclass Fish extends Animal {\n  fly() { throw new Error('no wings'); }\n}`,
      ),
    );

    expect(result.status).toBe("uncertain");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      'Could not confidently confirm or rule out a substitutability violation. "Fish" overrides "fly" from "Animal" and throws.',
    );
  });

  test("reports a violation for two throwing overrides", async () => {
    const result = await rule.evaluate(
      subjectOf(
        `${PARENT}\nclass Rock extends Animal {\n  speak() { throw new Error('silent'); }\n  fly() { throw new Error('heavy'); }\n}`,
      ),
    );

    expect(result.status).toBe("violation");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.55);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      'Found substitutability evidence in overridden methods. "Rock" overrides "speak" from "Animal" and throws. "Rock" overrides "fly" from "Animal" and throws.',
    );
    expect(result.remediation).toBe(
      "Consider honouring the parent contract in the override instead of throwing, or narrowing the hierarchy so the subclass is not used where the parent is expected.",
    );
  });

  test("reports uncertain when the parent is not defined in the subject", async () => {
    const result = await rule.evaluate(
      subjectOf("class Dog extends External {\n  speak() { throw new Error('loud'); }\n}"),
    );

    expect(result.status).toBe("uncertain");
    expect(result.confidence.value).toBe(0.4);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'Could not resolve a parent class locally to compare substitutability. "Dog" extends "External" which is not defined in this subject.',
    );
  });

  test("attaches evidence pointing at each throwing subclass", async () => {
    const result = await rule.evaluate(
      subjectOf(
        `${PARENT}\nclass Rock extends Animal {\n  speak() { throw new Error('silent'); }\n  fly() { throw new Error('heavy'); }\n}`,
      ),
    );

    expect(result.evidence).toHaveLength(2);
    const [first, second] = result.evidence;
    expect(first?.location.startLine).toBe(5);
    expect(first?.location.endLine).toBe(8);
    expect(first?.excerpt).toBe("class Rock extends Animal { … }");
    expect(second?.excerpt).toBe("class Rock extends Animal { … }");
  });

  test("always reports the language it was given, even when not_applicable", async () => {
    const result = await rule.evaluate(
      subjectOf("class Point {\n  getX() { return 1; }\n}", "javascript"),
    );

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer, not the engine", async () => {
    const result = await rule.evaluate(
      subjectOf("class Point {\n  getX() { return 1; }\n}"),
    );

    expect(result.analyzer.name).toBe("principled-solid-lsp");
  });

  test("discloses its heuristic limitations on every real verdict", async () => {
    const result = await rule.evaluate(
      subjectOf(`${PARENT}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}`),
    );

    expect(result.limitations).toEqual([
      "Finds class hierarchies and method bodies with lightweight text scanning, not a full parser: unusual formatting, class fields defined as arrow functions, and decorators with nested parentheses can be missed.",
      "Reads only an override that throws as substitutability risk; strengthened preconditions, weakened postconditions, and incompatible return values expressed without a throw are out of scope for this version.",
      "Compares only against parents defined in the same subject; a subclass of an external type cannot be judged and is reported uncertain, never compliant.",
    ]);
  });

  test("does not disclose limitations on a not_applicable result", async () => {
    const result = await rule.evaluate(
      subjectOf("class Point {\n  getX() { return 1; }\n}", "python"),
    );

    expect(result.limitations).toEqual([]);
  });
});
