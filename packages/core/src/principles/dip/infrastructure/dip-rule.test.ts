import { describe, expect, test } from "bun:test";
import { unwrap } from "../../../shared/result.ts";
import { Subject } from "../../../engine/domain/subject.ts";
import { DIP_RULE_ID, DipRule } from "./dip-rule.ts";

function subjectOf(sourceCode: string, language = "typescript") {
  return unwrap(Subject.of({ sourceCode, language }));
}

const rule = new DipRule();

describe("DipRule", () => {
  test("has the stable rule id solid.dip", () => {
    expect(rule.id).toBe(DIP_RULE_ID);
    expect(rule.id).toBe("solid.dip");
  });

  test("reports not_applicable, deterministically, for an unsupported language", async () => {
    const result = await rule.evaluate(
      subjectOf('import fs from "node:fs";', "python"),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.method).toBe("deterministic");
    expect(result.confidence.value).toBe(1);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.explanation).toBe(
      'This rule does not yet know how to detect dependency signals in "python".',
    );
  });

  test("reports compliant for decoupled code", async () => {
    const result = await rule.evaluate(
      subjectOf('import { format } from "./format";\nconst m = new Map();'),
    );

    expect(result.status).toBe("compliant");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.65);
    expect(result.humanReviewRecommended).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "No dependency-inversion evidence in concrete couplings. Found 0 inversion signal(s): 0 infrastructure import(s), 0 concrete instantiation(s).",
    );
  });

  test("reports uncertain for exactly one signal", async () => {
    const result = await rule.evaluate(subjectOf('import fs from "node:fs";'));

    expect(result.status).toBe("uncertain");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.4);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.remediation).toBeUndefined();
    expect(result.explanation).toBe(
      "Could not confidently confirm or rule out a dependency-inversion violation. Found 1 inversion signal(s): 1 infrastructure import(s), 0 concrete instantiation(s).",
    );
  });

  test("reports a violation for two or more signals", async () => {
    const source = [
      'import { Pool } from "pg";',
      "export class UserStore {",
      "  private pool = new Pool();",
      "}",
    ].join("\n");
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("violation");
    expect(result.method).toBe("heuristic");
    expect(result.confidence.value).toBe(0.55);
    expect(result.humanReviewRecommended).toBe(true);
    expect(result.explanation).toBe(
      "Found dependency-inversion evidence in concrete couplings. Found 2 inversion signal(s): 1 infrastructure import(s), 1 concrete instantiation(s).",
    );
    expect(result.remediation).toBe(
      "Consider depending on an abstraction: inject the infrastructure behind a port your code owns so high-level logic never names a concrete client, pool, or broker.",
    );
  });

  test("attaches evidence pointing at the first signal line", async () => {
    const source = 'import { format } from "./format";\nimport fs from "node:fs";\nconst m = new Map();';
    const result = await rule.evaluate(subjectOf(source));

    expect(result.status).toBe("uncertain");
    expect(result.evidence).toHaveLength(1);
    const [evidence] = result.evidence;
    expect(evidence?.location.startLine).toBe(2);
    expect(evidence?.location.endLine).toBe(2);
    expect(evidence?.excerpt).toBe('import fs from "node:fs";');
  });

  test("ignores imports hidden in comments", async () => {
    const result = await rule.evaluate(
      subjectOf('// import fs from "node:fs";\nconst x = 1;'),
    );

    expect(result.status).toBe("compliant");
    expect(result.evidence).toEqual([]);
  });

  test("always reports the language it was given, even when not_applicable", async () => {
    const result = await rule.evaluate(
      subjectOf('import fs from "node:fs";', "javascript"),
    );

    expect(result.language).toBe("javascript");
  });

  test("always names itself as the analyzer, not the engine", async () => {
    const result = await rule.evaluate(
      subjectOf('import { format } from "./format";'),
    );

    expect(result.analyzer.name).toBe("principled-solid-dip");
  });

  test("discloses its heuristic limitations on every real verdict", async () => {
    const result = await rule.evaluate(
      subjectOf('import { format } from "./format";'),
    );

    expect(result.limitations).toEqual([
      "Reads imports and new-expressions with lightweight text scanning, not a full parser: re-exports through barrels, computed specifiers, template-literal imports, and injection frameworks can be missed or miscounted.",
      "Treats every infrastructure import as coupling; using an infrastructure module behind a narrow, owned abstraction is reported the same way as scattering it through high-level logic.",
      "Knows only the infrastructure modules in its fixed list; a new client library or an in-house wrapper named outside that list is invisible to this version.",
    ]);
  });

  test("does not disclose limitations on a not_applicable result", async () => {
    const result = await rule.evaluate(
      subjectOf('import fs from "node:fs";', "python"),
    );

    expect(result.limitations).toEqual([]);
  });
});
