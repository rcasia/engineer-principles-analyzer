import { describe, expect, test } from "bun:test";
import {
  assessLsp,
  UNCERTAIN_RISKY_OVERRIDE_THRESHOLD,
  VIOLATION_RISKY_OVERRIDE_THRESHOLD,
} from "./lsp-assessment.ts";

const PARENT = "class Animal {\n  speak() { return '...'; }\n  fly() { return '...'; }\n}";

describe("assessLsp", () => {
  test("exposes its thresholds", () => {
    expect(VIOLATION_RISKY_OVERRIDE_THRESHOLD).toBe(2);
    expect(UNCERTAIN_RISKY_OVERRIDE_THRESHOLD).toBe(1);
  });

  test("is not_applicable when there is no inheritance at all", () => {
    const assessment = assessLsp("class Point {\n  getX() { return 1; }\n}");

    expect(assessment.verdict).toBe("not_applicable");
    expect(assessment.reason).toBe("no_inheritance");
    expect(assessment.riskyOverrides).toEqual([]);
    expect(assessment.unresolved).toEqual([]);
    expect(assessment.resolvedSubclassCount).toBe(0);
  });

  test("is compliant when overrides never throw", () => {
    const assessment = assessLsp(
      `${PARENT}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}`,
    );

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.reason).toBe("risky_override_count");
    expect(assessment.resolvedSubclassCount).toBe(1);
    expect(assessment.riskyOverrides).toEqual([]);
  });

  test("is compliant when the subclass adds methods without overriding", () => {
    const assessment = assessLsp(
      `${PARENT}\nclass Dog extends Animal {\n  bark() { return 'woof'; }\n}`,
    );

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.riskyOverrides).toEqual([]);
  });

  test("is uncertain with exactly one throwing override", () => {
    const assessment = assessLsp(
      `${PARENT}\nclass Fish extends Animal {\n  fly() { throw new Error('no wings'); }\n}`,
    );

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.reason).toBe("risky_override_count");
    expect(assessment.riskyOverrides).toHaveLength(1);
    expect(assessment.riskyOverrides[0]?.subclass.name).toBe("Fish");
    expect(assessment.riskyOverrides[0]?.parentName).toBe("Animal");
    expect(assessment.riskyOverrides[0]?.methodName).toBe("fly");
  });

  test("is a violation with two throwing overrides", () => {
    const assessment = assessLsp(
      `${PARENT}\nclass Rock extends Animal {\n  speak() { throw new Error('silent'); }\n  fly() { throw new Error('heavy'); }\n}`,
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.riskyOverrides.map((risk) => risk.methodName)).toEqual([
      "speak",
      "fly",
    ]);
  });

  test("ignores a throw in a method the parent never defined", () => {
    const assessment = assessLsp(
      `${PARENT}\nclass Dog extends Animal {\n  dig() { throw new Error('tired'); }\n}`,
    );

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.riskyOverrides).toEqual([]);
  });

  test("is uncertain when no parent is defined in the subject", () => {
    const assessment = assessLsp(
      "class Dog extends External {\n  speak() { throw new Error('loud'); }\n}",
    );

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.reason).toBe("unresolved_parent");
    expect(assessment.resolvedSubclassCount).toBe(0);
    expect(assessment.unresolved).toHaveLength(1);
    expect(assessment.unresolved[0]?.parentName).toBe("External");
  });
});
