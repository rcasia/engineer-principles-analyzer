import { describe, expect, test } from "bun:test";
import { assessClass, MINIMUM_METHODS_TO_ASSESS, UNCERTAIN_DOMAIN_THRESHOLD, VIOLATION_DOMAIN_THRESHOLD } from "./class-assessment.ts";
import type { ClassDeclaration } from "./class-declaration.ts";

function declarationWithBody(body: string): ClassDeclaration {
  return {
    name: "Subject",
    startLine: 1,
    endLine: 10,
    headerExcerpt: "class Subject",
    body,
  };
}

describe("thresholds", () => {
  test("MINIMUM_METHODS_TO_ASSESS is 3", () => {
    expect(MINIMUM_METHODS_TO_ASSESS).toBe(3);
  });

  test("UNCERTAIN_DOMAIN_THRESHOLD is 2", () => {
    expect(UNCERTAIN_DOMAIN_THRESHOLD).toBe(2);
  });

  test("VIOLATION_DOMAIN_THRESHOLD is 3", () => {
    expect(VIOLATION_DOMAIN_THRESHOLD).toBe(3);
  });
});

describe("assessClass", () => {
  test("marks a class below the method-count floor as uncertain, for too_few_methods", () => {
    const declaration = declarationWithBody("foo() {}\n  bar() {}");
    const assessment = assessClass(declaration);

    expect(assessment.methodCount).toBe(2);
    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.reason).toBe("too_few_methods");
    expect(assessment.domains).toEqual([]);
  });

  test("still assesses domains once the method-count floor is met", () => {
    const declaration = declarationWithBody("save() {}\n  load() {}\n  build() {}");
    const assessment = assessClass(declaration);

    expect(assessment.methodCount).toBe(3);
    expect(assessment.reason).toBe("domain_count");
  });

  test("is compliant with zero responsibility domains", () => {
    const declaration = declarationWithBody("build() {}\n  process() {}\n  handle() {}");
    const assessment = assessClass(declaration);

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.domains).toEqual([]);
  });

  test("is compliant with exactly one responsibility domain", () => {
    const declaration = declarationWithBody(
      "save() {}\n  load() {}\n  build() {}",
    );
    const assessment = assessClass(declaration);

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.domains).toHaveLength(1);
  });

  test("is uncertain with exactly two responsibility domains", () => {
    const declaration = declarationWithBody(
      "save() {}\n  load() {}\n  send() {}\n  notify() {}",
    );
    const assessment = assessClass(declaration);

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.reason).toBe("domain_count");
    expect(assessment.domains).toHaveLength(2);
  });

  test("is a violation with three or more responsibility domains", () => {
    const declaration = declarationWithBody(
      "save() {}\n  load() {}\n  send() {}\n  notify() {}\n  render() {}\n  display() {}",
    );
    const assessment = assessClass(declaration);

    expect(assessment.verdict).toBe("violation");
    expect(assessment.domains).toHaveLength(3);
  });

  test("keeps the declaration on the returned assessment unchanged", () => {
    const declaration = declarationWithBody("foo() {}");
    const assessment = assessClass(declaration);

    expect(assessment.declaration).toBe(declaration);
  });
});
