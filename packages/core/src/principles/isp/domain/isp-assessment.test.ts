import { describe, expect, test } from "bun:test";
import {
  assessIsp,
  UNCERTAIN_MEMBER_THRESHOLD,
  VIOLATION_MEMBER_THRESHOLD,
} from "./isp-assessment.ts";

function members(count: number): string {
  return Array.from({ length: count }, (_, i) => `  op${i}(): void;`).join("\n");
}

describe("assessIsp", () => {
  test("exposes its thresholds", () => {
    expect(VIOLATION_MEMBER_THRESHOLD).toBe(7);
    expect(UNCERTAIN_MEMBER_THRESHOLD).toBe(5);
  });

  test("is not_applicable when there is no interface-shaped construct", () => {
    const assessment = assessIsp("export function add(a, b) { return a + b; }");

    expect(assessment.verdict).toBe("not_applicable");
    expect(assessment.reason).toBe("no_interface");
    expect(assessment.highlighted).toEqual([]);
  });

  test("is compliant when every interface is narrow", () => {
    const assessment = assessIsp(`interface User {\n${members(3)}\n}`);

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.reason).toBe("member_count");
    expect(assessment.highlighted).toHaveLength(1);
  });

  test("is uncertain when the broadest interface has exactly five members", () => {
    const assessment = assessIsp(`interface Service {\n${members(5)}\n}`);

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.highlighted).toHaveLength(1);
    expect(assessment.highlighted[0]?.memberCount).toBe(5);
  });

  test("is a violation when an interface has exactly seven members", () => {
    const assessment = assessIsp(`interface God {\n${members(7)}\n}`);

    expect(assessment.verdict).toBe("violation");
    expect(assessment.highlighted).toHaveLength(1);
    expect(assessment.highlighted[0]?.name).toBe("God");
  });

  test("a violation outranks uncertain and compliant interfaces in the same subject", () => {
    const assessment = assessIsp(
      `interface Narrow {\n${members(2)}\n}\ninterface Wide {\n${members(5)}\n}\ninterface God {\n${members(8)}\n}`,
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.highlighted.map((info) => info.name)).toEqual(["God"]);
  });

  test("uncertain outranks compliant when there is no violation", () => {
    const assessment = assessIsp(
      `interface Narrow {\n${members(2)}\n}\ninterface Wide {\n${members(6)}\n}`,
    );

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.highlighted.map((info) => info.name)).toEqual(["Wide"]);
  });

  test("sorts interfaces broadest first", () => {
    const assessment = assessIsp(
      `interface Narrow {\n${members(2)}\n}\ninterface Wide {\n${members(4)}\n}`,
    );

    expect(assessment.interfaces.map((info) => info.name)).toEqual(["Wide", "Narrow"]);
  });
});
