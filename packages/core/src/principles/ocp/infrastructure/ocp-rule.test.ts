import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { OCP_RULE_ID, OcpRule } from "./ocp-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

const rule = new OcpRule();

describe("OcpRule", () => {
  test("has the stable rule id solid.ocp", () => {
    expect(rule.id).toBe(OCP_RULE_ID);
    expect(rule.id).toBe("solid.ocp");
  });

  test("reports not_applicable, deterministically, for an unsupported language", async () => {
    const result = await rule.evaluate(subjectOf("switch (x) {}", "python"));

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'This rule does not yet know how to detect extension signals in "python".',
    );
  });

  test("reports compliant for sequential code with no signals", async () => {
    const result = await rule.evaluate(subjectOf("const x = 1;\nreturn x + 1;"));

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No branching evidence of extension by modification. Found 0 extension signal(s): 0 switch statement(s), 0 else-if(s), 0 type guard(s).",
    );
  });

  test("reports compliant for a single type guard", async () => {
    const result = await rule.evaluate(
      subjectOf("if (typeof x === 'string') { return x; }"),
    );

    expect(result.status).toBe("compliant");
    expect(result.confidence.value).toBe(0.65);
    expect(result.evidence).toHaveLength(1);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No branching evidence of extension by modification. Found 1 extension signal(s): 0 switch statement(s), 0 else-if(s), 1 type guard(s).",
    );
  });

  test("reports uncertain for exactly two signals", async () => {
    const result = await rule.evaluate(
      subjectOf("if (typeof x === 'string') {}\nif (y instanceof Foo) {}"),
    );

    expect(result.status).toBe("uncertain");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "Could not confidently confirm or rule out an open/closed violation. Found 2 extension signal(s): 0 switch statement(s), 0 else-if(s), 2 type guard(s).",
    );
  });

  test("reports a violation for three or more signals", async () => {
    const source = [
      "function area(shape) {",
      "  switch (shape.kind) {",
      "    case 'circle': return 1;",
      "  }",
      "  if (typeof shape === 'string') {}",
      "  if (shape instanceof Circle) {}",
      "}",
    ].join("\n");
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.55);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(result.explanation).toBe(
      "Found branching evidence of extension by modification. Found 3 extension signal(s): 1 switch statement(s), 0 else-if(s), 2 type guard(s).",
    );
    expect(result.remediation).toBe(
      "Consider opening the branched logic for extension: replace type-based dispatch with polymorphism or a handler registry so new cases add code instead of editing existing branches.",
    );
  });

  test("attaches evidence pointing at the first signal line", async () => {
    const source = "const x = 1;\nif (a) {} else if (b) {}\nif (c) {} else if (d) {}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("uncertain");
    expect(result.evidence).toHaveLength(1);
    const [evidence] = result.evidence;
    expect(evidence?.location.startLine).toBe(2);
    expect(evidence?.location.endLine).toBe(2);
    expect(evidence?.excerpt).toBe("if (a) {} else if (b) {}");
  });

  test("ignores branches hidden in strings and comments", async () => {
    const source = 'const s = "switch";\n// else if\nconst x = 1;';
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("compliant");
    expect(result.evidence).toEqual([]);
  });

  test("always reports the language it was given, even when not_applicable", async () => {
    const result = await rule.evaluate(subjectOf("switch (x) {}", "javascript"));

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer, not the engine", async () => {
    const result = await rule.evaluate(subjectOf("const x = 1;"));

    expect(result.analyzer.name).toBe("principled-solid-ocp");
  });

  test("discloses its heuristic limitations on every real verdict", async () => {
    const result = await rule.evaluate(subjectOf("const x = 1;"));

    expect(result.limitations).toEqual([
      "Counts switch statements, else-if chains, and typeof/instanceof type guards with lightweight text scanning, not a full parser: branches hidden in strings, templates, or comments are ignored, but unusual formatting can still miscount.",
      "Treats every branch as extension pressure; a genuinely closed set of cases (days of the week, an exhaustive state machine) is reported the same way as a type-dispatch chain that should have been polymorphism.",
      "Cannot see extension points it does not look for: polymorphism, composition, registries, or plugin hooks already in place are out of scope for this version.",
    ]);
  });

  test("does not disclose limitations on a not_applicable result", async () => {
    const result = await rule.evaluate(subjectOf("switch (x) {}", "python"));

    expect(result.limitations).toEqual([]);
  });
});
