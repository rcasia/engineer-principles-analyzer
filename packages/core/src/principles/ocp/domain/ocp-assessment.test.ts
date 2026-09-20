import { describe, expect, test } from "bun:test";
import {
  assessOcp,
  UNCERTAIN_SIGNAL_THRESHOLD,
  VIOLATION_SIGNAL_THRESHOLD,
} from "./ocp-assessment.ts";

describe("assessOcp", () => {
  test("exposes its thresholds", () => {
    expect(VIOLATION_SIGNAL_THRESHOLD).toBe(3);
    expect(UNCERTAIN_SIGNAL_THRESHOLD).toBe(2);
  });

  test("is compliant with zero signals", () => {
    const assessment = assessOcp("const x = 1;\nreturn x + 1;");

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.signals.total).toBe(0);
  });

  test("is compliant with exactly one signal", () => {
    const assessment = assessOcp("if (typeof x === 'string') {}");

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.signals).toEqual({
      switches: 0,
      elseIfs: 0,
      typeGuards: 1,
      total: 1,
    });
  });

  test("is uncertain with exactly two signals", () => {
    const assessment = assessOcp(
      "if (typeof x === 'string') {}\nif (y instanceof Foo) {}",
    );

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.signals.total).toBe(2);
  });

  test("is a violation with exactly three signals", () => {
    const assessment = assessOcp(
      "switch (k) {}\nif (typeof x === 'string') {}\nif (y instanceof Foo) {}",
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.signals).toEqual({
      switches: 1,
      elseIfs: 0,
      typeGuards: 2,
      total: 3,
    });
  });

  test("stays a violation past the threshold", () => {
    const assessment = assessOcp(
      "switch (a) {}\nswitch (b) {}\nif (c) {} else if (d) {}\nif (typeof e === 's') {}\nif (f instanceof G) {}",
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.signals.total).toBe(5);
  });
});
