import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { ISP_RULE_ID, IspRule } from "./isp-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

function members(count: number): string {
  return Array.from({ length: count }, (_, i) => `  op${i}(): void;`).join("\n");
}

const rule = new IspRule();

describe("IspRule", () => {
  test("has the stable rule id solid.isp", () => {
    expect(rule.id).toBe(ISP_RULE_ID);
    expect(rule.id).toBe("solid.isp");
  });

  test("reports not_applicable, deterministically, for an unsupported language", async () => {
    const result = await rule.evaluate(
      subjectOf("interface A {\n  x: number;\n}", "python"),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'This rule does not yet know how to detect interfaces in "python".',
    );
  });

  test("analyzes an unknown language generically", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface User {\n${members(3)}\n}`, "unknown"),
    );

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.language).toBe("unknown");
  });

  test("reads unknown despite surrounding whitespace and case", async () => {
    const result = await rule.evaluate(
      subjectOf("export function add(a: number, b: number) { return a + b; }", " Unknown "),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.language).toBe(" Unknown ");
    expect(result.explanation).toBe(
      "No interface- or object-type construct was found to evaluate for interface segregation.",
    );
  });

  test("reports not_applicable when the subject has no interface", async () => {
    const result = await rule.evaluate(
      subjectOf("export function add(a: number, b: number) { return a + b; }"),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      "No interface- or object-type construct was found to evaluate for interface segregation.",
    );
  });

  test("reports compliant for narrow interfaces", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface User {\n${members(3)}\n}`),
    );

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No interface showed evidence of unrelated-operation grouping. Checked 1 interface(s); the broadest exposes 3 member(s).",
    );
  });

  test("reports uncertain for an interface with exactly five members", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface Service {\n${members(5)}\n}`),
    );

    expect(result.status).toBe("uncertain");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      'Could not confidently confirm or rule out an interface-segregation violation. "Service" exposes 5 member(s).',
    );
  });

  test("reports a violation for an interface with seven or more members", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface God {\n${members(8)}\n}`),
    );

    expect(result.status).toBe("violation");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.55);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      'Found interface-segregation evidence in broad interfaces. "God" exposes 8 member(s).',
    );
    expect(result.remediation).toBe(
      "Consider splitting the broad interface: group related operations behind consumer-specific interfaces so clients depend only on what they use.",
    );
  });

  test("joins several broad interfaces' details with '. '", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface Alpha {\n${members(7)}\n}\ninterface Beta {\n${members(8)}\n}`),
    );

    expect(result.status).toBe("violation");
    expect(result.explanation).toBe(
      'Found interface-segregation evidence in broad interfaces. "Beta" exposes 8 member(s). "Alpha" exposes 7 member(s).',
    );
  });

  test("attaches evidence pointing at the broad interface only", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface Narrow {\n${members(2)}\n}\ninterface God {\n${members(7)}\n}`),
    );

    expect(result.status).toBe("violation");
    expect(result.evidence).toHaveLength(1);
    const [evidence] = result.evidence;
    expect(evidence?.location.startLine).toBe(5);
    expect(evidence?.location.endLine).toBe(13);
    expect(evidence?.excerpt).toBe("interface God { … }");
    expect(result.explanation).not.toContain("Narrow");
  });

  test("reads object type literals as well as interfaces", async () => {
    const result = await rule.evaluate(
      subjectOf(`type Config = {\n${members(7)}\n};`),
    );

    expect(result.status).toBe("violation");
    expect(result.explanation).toBe(
      'Found interface-segregation evidence in broad interfaces. "Config" exposes 7 member(s).',
    );
  });

  test("always reports the language it was given, even when not_applicable", async () => {
    const result = await rule.evaluate(
      subjectOf("export function add(a, b) { return a + b; }", "javascript"),
    );

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer, not the engine", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface User {\n${members(2)}\n}`),
    );

    expect(result.analyzer.name).toBe("principled-solid-isp");
  });

  test("discloses its heuristic limitations on every real verdict", async () => {
    const result = await rule.evaluate(
      subjectOf(`interface User {\n${members(2)}\n}`),
    );

    expect(result.limitations).toEqual([
      "Finds interface and object-type members with lightweight text scanning, not a full parser: signatures broken across lines, conditional or mapped types, and unusual formatting can be miscounted.",
      "Reads member count as breadth; a large but cohesive set of related operations is reported the same way as unrelated operations forced on one client.",
      "Cannot see clients at all in a single subject: whether any consumer actually suffers the unused members is out of scope for this version.",
    ]);
  });

  test("does not disclose limitations on a not_applicable result", async () => {
    const result = await rule.evaluate(
      subjectOf("interface A {\n  x: number;\n}", "python"),
    );

    expect(result.limitations).toEqual([]);
  });
});
