import { describe, expect, test } from "bun:test";
import { AnalyzeSubject } from "../../engine/application/analyze-subject.use-case.ts";
import { InMemoryRuleCatalog } from "../../engine/infrastructure/in-memory-rule-catalog.ts";
import { DipRule } from "../../principles/dip/infrastructure/dip-rule.ts";
import { IspRule } from "../../principles/isp/infrastructure/isp-rule.ts";
import { LspRule } from "../../principles/lsp/infrastructure/lsp-rule.ts";
import { OcpRule } from "../../principles/ocp/infrastructure/ocp-rule.ts";
import { SrpRule } from "../../principles/srp/infrastructure/srp-rule.ts";
import { publishSnapshot } from "../domain/evaluation-snapshot.ts";
import { validateCorpus } from "../domain/corpus-entry.ts";
import { EvaluateCorpus } from "../application/evaluate-corpus.use-case.ts";
import { SOLID_CORPUS, SOLID_CORPUS_VERSION } from "./solid-corpus-v1.ts";

function harness(): EvaluateCorpus {
  return new EvaluateCorpus(
    new AnalyzeSubject(
      new InMemoryRuleCatalog([
        new SrpRule(),
        new OcpRule(),
        new LspRule(),
        new IspRule(),
        new DipRule(),
      ]),
    ),
  );
}

describe("solid corpus v1", () => {
  test(`carries version ${SOLID_CORPUS_VERSION} and twenty fixtures, four per rule`, () => {
    expect(SOLID_CORPUS_VERSION).toBe("1");
    expect(SOLID_CORPUS).toHaveLength(20);

    const perRule = new Map<string, number>();

    for (const entry of SOLID_CORPUS) {
      perRule.set(entry.ruleId, (perRule.get(entry.ruleId) ?? 0) + 1);
    }

    expect([...perRule.entries()]).toEqual([
      ["solid.srp", 4],
      ["solid.ocp", 4],
      ["solid.lsp", 4],
      ["solid.isp", 4],
      ["solid.dip", 4],
    ]);
  });

  test("passes its own validation gate", () => {
    const result = validateCorpus(SOLID_CORPUS);

    expect(result.ok).toBe(true);
  });

  test("pins every fixture's source exactly as the rules judged it", () => {
    // Each rule's verdicts above depend on these exact characters: a
    // dropped line or a collapsed newline would measure a different
    // fixture, so the corpus pins its sources literally.
    expect(SOLID_CORPUS.map((entry) => entry.sourceCode)).toEqual([
      'class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}',
      'class AccountService {\n  validate(account) {}\n  check(account) {}\n  calculate(interest) {}\n  compute(fees) {}\n  authenticate(user) {}\n  authorize(user) {}\n}',
      'class Calculator {\n  add(a, b) {}\n  subtract(a, b) {}\n  multiply(a, b) {}\n}',
      'class UserStore {\n  save(user) {}\n  load(id) {}\n  fetch(id) {}\n  query(filter) {}\n}',
      "function area(shape) {\n  switch (shape.kind) {\n    case 'circle': return 1;\n  }\n  if (typeof shape === 'string') {}\n  if (shape instanceof Circle) {}\n}",
      'function route(event) {\n  switch (event.kind) {}\n  if (a) {} else if (b) {}\n  if (c) {} else if (d) {}\n}',
      'const x = 1;\nreturn x + 1;',
      "if (typeof x === 'string') { return x; }",
      "class Animal {\n  speak() { return '...'; }\n  fly() { return '...'; }\n}\nclass Rock extends Animal {\n  speak() { throw new Error('silent'); }\n  fly() { throw new Error('heavy'); }\n}",
      "class Animal {\n  speak() { return '...'; }\n  fly() { return '...'; }\n}\nclass Fish extends Animal {\n  fly() { throw new Error('no wings'); }\n}\nclass Stone extends Animal {\n  speak() { throw new Error('silent'); }\n}",
      "class Animal {\n  speak() { return '...'; }\n}\nclass Dog extends Animal {\n  speak() { return 'woof'; }\n}",
      "class Animal {\n  speak() { return '...'; }\n}\nclass Dog extends Animal {\n  bark() { return 'woof'; }\n}",
      'interface God {\n  op0(): void;\n  op1(): void;\n  op2(): void;\n  op3(): void;\n  op4(): void;\n  op5(): void;\n  op6(): void;\n  op7(): void;\n}',
      'type Config = {\n  host: string;\n  port: number;\n  retries: number;\n  timeout: number;\n  verbose: boolean;\n  format: string;\n  output: string;\n};',
      'interface User {\n  name: string;\n  age: number;\n  email: string;\n}',
      'type Point = {\n  x: number;\n  y: number;\n};',
      'import { Pool } from "pg";\nexport class UserStore {\n  private pool = new Pool();\n}',
      'import fs from "node:fs";\nimport axios from "axios";\nexport function load(url: string) {}',
      'import { format } from "./format";\nconst cache = new Map();',
      'export function add(a: number, b: number) { return a + b; }',
    ]);
  });

  test("every rule scores perfect precision and recall on its four fixtures", async () => {
    const { qualities } = await harness().execute({ entries: SOLID_CORPUS });

    expect(qualities.map((quality) => quality.ruleId)).toEqual([
      "solid.srp",
      "solid.ocp",
      "solid.lsp",
      "solid.isp",
      "solid.dip",
    ]);

    for (const quality of qualities) {
      expect(quality.language).toBe("typescript");
      expect(quality.precision).toBe(1);
      expect(quality.recall).toBe(1);
      expect(quality.falsePositiveRate).toBe(0);
      expect(quality.falseNegativeRate).toBe(0);
      expect(quality.sampleSize).toBe(4);
      expect(quality.meanConfidence).toBeCloseTo(0.6, 10);
      expect(quality.calibrationGap).toBeCloseTo(0.4, 10);
    }
  });

  test("measures honest per-rule evidence coverage from each rule's evidence policy", async () => {
    const { qualities } = await harness().execute({ entries: SOLID_CORPUS });
    const coverage = new Map(
      qualities.map((quality) => [quality.ruleId, quality.evidenceCoverage]),
    );

    // SRP and ISP attach evidence behind compliant verdicts too; OCP, LSP
    // and DIP attach evidence only where a signal exists, so their quiet
    // compliant fixtures lower the fraction. These numbers pin the v1
    // policies — changing a rule's evidence policy moves its number here.
    expect(coverage.get("solid.srp")).toBe(1);
    expect(coverage.get("solid.ocp")).toBe(0.75);
    expect(coverage.get("solid.lsp")).toBe(0.5);
    expect(coverage.get("solid.isp")).toBe(1);
    expect(coverage.get("solid.dip")).toBe(0.5);
  });

  test("feeds a publishable evaluation snapshot", async () => {
    const { qualities } = await harness().execute({ entries: SOLID_CORPUS });
    const snapshot = publishSnapshot({
      principledVersion: "1",
      ruleVersions: {
        "solid.srp": "1",
        "solid.ocp": "1",
        "solid.lsp": "1",
        "solid.isp": "1",
        "solid.dip": "1",
      },
      corpusVersion: SOLID_CORPUS_VERSION,
      evaluatedAt: "2026-09-20",
      methodology:
        "Ran solid-corpus-v1 through AnalyzeSubject with the five v1 SOLID heuristics and summarized confusion counts per rule with EvaluateCorpus.",
      entries: qualities,
      limitations: [
        "Twenty synthetic TypeScript fixtures pin clear-cut cases only; ambiguous subjects are not corpus material.",
      ],
    });

    expect(snapshot.ok).toBe(true);

    if (snapshot.ok) {
      expect(snapshot.value.corpusVersion).toBe("1");
      expect(snapshot.value.entries).toHaveLength(5);
    }
  });
});
