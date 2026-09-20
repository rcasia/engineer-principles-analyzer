import { describe, expect, test } from "bun:test";
import {
  assessDip,
  UNCERTAIN_SIGNAL_THRESHOLD,
  VIOLATION_SIGNAL_THRESHOLD,
} from "./dip-assessment.ts";

describe("assessDip", () => {
  test("exposes its thresholds", () => {
    expect(VIOLATION_SIGNAL_THRESHOLD).toBe(2);
    expect(UNCERTAIN_SIGNAL_THRESHOLD).toBe(1);
  });

  test("is compliant with zero signals", () => {
    const assessment = assessDip('import { format } from "./format";');

    expect(assessment.verdict).toBe("compliant");
    expect(assessment.signals.total).toBe(0);
  });

  test("is uncertain with exactly one signal", () => {
    const assessment = assessDip('import fs from "node:fs";');

    expect(assessment.verdict).toBe("uncertain");
    expect(assessment.signals).toEqual({
      infraImports: 1,
      concreteInstantiations: 0,
      total: 1,
    });
  });

  test("is a violation with exactly two signals", () => {
    const assessment = assessDip(
      'import { Pool } from "pg";\nconst pool = new Pool();',
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.signals).toEqual({
      infraImports: 1,
      concreteInstantiations: 1,
      total: 2,
    });
  });

  test("stays a violation past the threshold", () => {
    const assessment = assessDip(
      'import fs from "node:fs";\nimport { Pool } from "pg";\nconst pool = new Pool();',
    );

    expect(assessment.verdict).toBe("violation");
    expect(assessment.signals.total).toBe(3);
  });
});
