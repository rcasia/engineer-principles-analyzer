import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { SRP_RULE_ID, SrpRule } from "./srp-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

const rule = new SrpRule();

describe("SrpRule", () => {
  test("has the stable rule id solid.srp", () => {
    expect(rule.id).toBe(SRP_RULE_ID);
    expect(rule.id).toBe("solid.srp");
  });

  test("reports not_applicable, deterministically, for an unsupported language", async () => {
    const result = await rule.evaluate(subjectOf("class Foo {}", "python"));

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'This rule does not yet know how to detect class-shaped constructs in "python".',
    );
  });

  test("reports not_applicable when the subject has no class construct", async () => {
    const result = await rule.evaluate(
      subjectOf("export function add(a: number, b: number) { return a + b; }"),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      "No class-like construct was found to evaluate for responsibility concentration.",
    );
  });

  test("reports uncertain for a class with too few methods to assess confidently", async () => {
    const result = await rule.evaluate(
      subjectOf("class Point {\n  getX() { return this.x; }\n}"),
    );

    expect(result.status).toBe("uncertain");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      'Could not confidently confirm or rule out a single-responsibility violation. "Point" has only 1 method(s), too few to assess confidently.',
    );
    expect(result.remediation).toBeUndefined();
  });

  test("reports compliant for a cohesive class with no responsibility-domain signal", async () => {
    const source = "class Calculator {\n  add(a, b) {}\n  subtract(a, b) {}\n  multiply(a, b) {}\n}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No class showed method-name evidence of more than one responsibility domain. \"Calculator\"'s methods did not match more than one responsibility domain.",
    );
  });

  test("reports uncertain for a class touching exactly two responsibility domains", async () => {
    const source = "class UserService {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("uncertain");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "Could not confidently confirm or rule out a single-responsibility violation. " +
        '"UserService" touches 2 responsibility domains: persistence (save, load); communication (send, notify).',
    );
  });

  test("reports a violation for a class touching three or more responsibility domains", async () => {
    const source = "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.55);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.location.startLine).toBe(1);
    expect(result.explanation).toBe(
      "Found method-name evidence of concentrated responsibility. " +
        '"UserManager" touches 3 responsibility domains: persistence (save, load); communication (send, notify); presentation (render, display).',
    );
    expect(result.remediation).toBe(
      'Consider splitting responsibilities: extract persistence/communication/presentation out of "UserManager" into its own collaborator(s).',
    );
  });

  test("joins multiple violating classes' details with '. ' and their remediations with '; '", async () => {
    const source = `
      class A {
        save(user) {}
        load(id) {}
        send(email) {}
        notify(user) {}
        render(user) {}
        display(user) {}
      }
      class B {
        validate(x) {}
        check(x) {}
        calculate(x) {}
        compute(x) {}
        authenticate(x) {}
        authorize(x) {}
      }
    `;
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
    expect(result.evidence).toHaveLength(2);
    expect(result.explanation).toBe(
      "Found method-name evidence of concentrated responsibility. " +
        '"A" touches 3 responsibility domains: persistence (save, load); communication (send, notify); presentation (render, display). ' +
        '"B" touches 3 responsibility domains: validation (validate, check); calculation (calculate, compute); authentication (authenticate, authorize).',
    );
    expect(result.remediation).toBe(
      "Consider splitting responsibilities: " +
        'extract persistence/communication/presentation out of "A" into its own collaborator(s); ' +
        'extract validation/calculation/authentication out of "B" into its own collaborator(s).',
    );
  });

  test("attaches evidence pointing at the class's declaration lines", async () => {
    const source = "class Foo {\n  save() {}\n  load() {}\n  send() {}\n  notify() {}\n  render() {}\n  display() {}\n}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.evidence).toHaveLength(1);
    const [evidence] = result.evidence;
    expect(evidence?.location.startLine).toBe(1);
    expect(evidence?.location.endLine).toBe(8);
    expect(evidence?.excerpt).toBe("class Foo { … }");
  });

  test("only attaches evidence for the classes matching the worst verdict, not every class", async () => {
    const source = `
      class Cohesive {
        add(a, b) {}
        subtract(a, b) {}
        multiply(a, b) {}
      }
      class Violating {
        save(user) {}
        load(id) {}
        send(email) {}
        notify(user) {}
        render(user) {}
        display(user) {}
      }
    `;
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
    expect(result.evidence).toHaveLength(1);
    expect(result.explanation).toContain("Violating");
    expect(result.explanation).not.toContain("Cohesive");
  });

  test("a violation outranks uncertain and compliant classes in the same subject", async () => {
    const source = `
      class TooSmall {
        getX() {}
      }
      class Violating {
        save(user) {}
        load(id) {}
        send(email) {}
        notify(user) {}
        render(user) {}
        display(user) {}
      }
    `;
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
  });

  test("uncertain outranks compliant when there is no violation", async () => {
    const source = `
      class Cohesive {
        add(a, b) {}
        subtract(a, b) {}
        multiply(a, b) {}
      }
      class TwoDomains {
        save(user) {}
        load(id) {}
        send(email) {}
        notify(user) {}
      }
    `;
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("uncertain");
  });

  test("always reports the language it was given, even when not_applicable", async () => {
    const result = await rule.evaluate(subjectOf("class Foo {}", "javascript"));

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer, not the engine", async () => {
    const result = await rule.evaluate(subjectOf("class Foo {}"));

    expect(result.analyzer.name).toBe("principled-solid-srp");
  });

  test("discloses its heuristic limitations on every real verdict", async () => {
    const source = "class Calculator {\n  add(a, b) {}\n  subtract(a, b) {}\n  multiply(a, b) {}\n}";
    const result = await rule.evaluate(subjectOf(source));

    expect(result.limitations).toEqual([
      "Finds class-shaped constructs and their top-level methods with lightweight text scanning, not a full parser: unusual formatting, class fields defined as arrow functions, and decorators with nested parentheses can be missed.",
      "Groups method names into responsibility domains using a fixed keyword dictionary; a method named outside that dictionary is not counted toward any domain, which can understate concentration.",
      "Evaluates cohesion by class only; a module of many unrelated top-level functions in a non-class style is out of scope for this version.",
    ]);
  });

  test("does not disclose limitations on a not_applicable result", async () => {
    const result = await rule.evaluate(subjectOf("class Foo {}", "python"));

    expect(result.limitations).toEqual([]);
  });
});
