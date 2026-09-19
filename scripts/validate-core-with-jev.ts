#!/usr/bin/env bun
/**
 * Validates the core engine against the live Jev service (ADR-0024).
 *
 * Runs `AnalyzeSubject` over a few hand-picked subjects with both the
 * deterministic `SrpRule` and the Jev-backed `JevSrpRule`, then prints the
 * two verdicts side by side. A developer-operated probe, not a CI gate:
 * Jev is non-deterministic and needs a credential, so this script requires
 * TYPESAFE_API_KEY in the environment and never runs in CI.
 *
 * The key is read from the environment and sent only in the Authorization
 * header. It is never printed, logged, or embedded in any output.
 */
import {
  AnalyzeSubject,
  HttpJevClient,
  InMemoryRuleCatalog,
  JevSrpRule,
  SrpRule,
  Subject,
  unwrap,
} from "../packages/core/src/index.ts";

const apiKey = Bun.env["TYPESAFE_API_KEY"];
if (apiKey === undefined || apiKey.trim().length === 0) {
  console.error("FAIL: set TYPESAFE_API_KEY in the environment first.");
  process.exit(1);
}

const SUBJECTS: { readonly name: string; readonly sourceCode: string }[] = [
  {
    name: "god-class",
    sourceCode: [
      "class UserManager {",
      "  save(user) {}",
      "  load(id) {}",
      "  send(email) {}",
      "  notify(user) {}",
      "  render(user) {}",
      "  display(user) {}",
      "}",
    ].join("\n"),
  },
  {
    name: "cohesive",
    sourceCode: [
      "class Calculator {",
      "  add(a, b) {}",
      "  subtract(a, b) {}",
      "  multiply(a, b) {}",
      "}",
    ].join("\n"),
  },
  {
    name: "too-small",
    sourceCode: ["class Point {", "  getX() { return this.x; }", "}"].join(
      "\n",
    ),
  },
];

const engine = new AnalyzeSubject(
  new InMemoryRuleCatalog([
    new SrpRule(),
    new JevSrpRule(
      new HttpJevClient({ apiKey, fetchFn: globalThis.fetch }),
    ),
  ]),
);

for (const candidate of SUBJECTS) {
  const subject = unwrap(
    Subject.of({ sourceCode: candidate.sourceCode, language: "typescript" }),
  );
  const run = await engine.execute({ subject });

  console.log(`\n## ${candidate.name}`);
  for (const result of run.results) {
    console.log(
      `- ${result.ruleId}: ${result.status} (${result.method}, confidence ${result.confidence.value})`,
    );
    console.log(`  explanation: ${result.explanation}`);
  }
}
