import { describe, expect, test } from "bun:test";
import {
  AnalyzeSubject,
  InMemoryJevClient,
  InMemoryRuleCatalog,
  JevLanguageDetector,
  SrpRule,
  Subject,
  UNKNOWN_LANGUAGE,
} from "@principled/core";
import { unwrap } from "@principled/core";
import { runAnalysis } from "./analysis/run-analysis.ts";
import { toPlainResult } from "./analysis/serialize-result.ts";

/**
 * Web/CLI parity (#20): the CLI must reach the same verdicts as the web
 * adapter for the same language. The adapters resolve the language
 * differently by design — the web judges content with Jev (ADR-0028),
 * the CLI resolves offline from `--language` or the file extension
 * (#43: no account, no network) — so these tests script the web's
 * detector through the same `JevClient` port production uses and assert
 * the findings match whenever both settle on one language. Detection
 * wording may differ; status, confidence, method, evidence and
 * explanation must not.
 */

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

const COMPLIANT_TS =
  "class Calculator {\n  add(a, b) {}\n  subtract(a, b) {}\n  multiply(a, b) {}\n}";

const PYTHON_SOURCE = "def greet(name):\n    print(name)\n";

function webDetector(choice: string): JevLanguageDetector {
  return new JevLanguageDetector(
    new InMemoryJevClient(undefined, [
      {
        choice,
        probabilities: { [choice]: 1 },
        confidence: 1,
        model: "in-memory",
      },
    ]),
  );
}

/** The web adapter's path: judge, fall back to unknown, run every rule. */
async function analyzeAsWeb(sourceCode: string, choice: string) {
  const language = (await webDetector(choice).detectLanguage(sourceCode)) ?? UNKNOWN_LANGUAGE;
  const subject = Subject.of({ sourceCode, language });
  if (!subject.ok) return subject;
  const analyze = new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()]));
  return {
    ok: true as const,
    language,
    run: await analyze.execute({ subject: subject.value }),
  };
}

describe("web/CLI parity", () => {
  test("a violating file produces identical findings in web and CLI", async () => {
    const web = await analyzeAsWeb(VIOLATING_TS, "typescript");
    const cli = await runAnalysis({
      sourceCode: VIOLATING_TS,
      filename: "user-manager.ts",
    });

    expect(cli.ok).toBe(true);
    if (!cli.ok || web === undefined || !("run" in web)) return;
    expect(cli.language).toBe(web.language);
    expect(cli.language).toBe("typescript");
    expect(cli.run.results.map(toPlainResult)).toEqual(
      web.run.results.map(toPlainResult),
    );
    expect(cli.run.results[0]?.status).toBe("violation");
  });

  test("an explicit CLI language matches the judged language", async () => {
    const web = await analyzeAsWeb(COMPLIANT_TS, "typescript");
    const cli = await runAnalysis({
      sourceCode: COMPLIANT_TS,
      language: "typescript",
    });

    expect(cli.ok).toBe(true);
    if (!cli.ok || web === undefined || !("run" in web)) return;
    expect(cli.run.results.map(toPlainResult)).toEqual(
      web.run.results.map(toPlainResult),
    );
    expect(cli.run.results[0]?.ruleId).toBe("solid.srp");
    expect(cli.run.results[0]?.status).toBe("compliant");
  });

  test("an out-of-scope language is not_applicable in both", async () => {
    const web = await analyzeAsWeb(PYTHON_SOURCE, "python");
    const cli = await runAnalysis({
      sourceCode: PYTHON_SOURCE,
      filename: "greet.py",
    });

    expect(cli.ok).toBe(true);
    if (!cli.ok || web === undefined || !("run" in web)) return;
    expect(cli.language).toBe("python");
    expect(cli.run.results.map(toPlainResult)).toEqual(
      web.run.results.map(toPlainResult),
    );
    expect(cli.run.results[0]?.status).toBe("not_applicable");
    expect(cli.run.results[0]?.method).toBe("deterministic");
    expect(cli.run.results[0]?.confidence.value).toBe(1);
  });

  test("empty source fails the same way in both", async () => {
    const web = await analyzeAsWeb("   ", "other");
    const cli = await runAnalysis({ sourceCode: "   ", filename: "empty.ts" });

    expect(cli.ok).toBe(false);
    if (cli.ok) return;
    expect(web.ok).toBe(false);
    if (web.ok) return;
    expect(cli.failure.message).toBe(web.error.message);
    expect(cli.failure.message).toBe("sourceCode must not be empty.");
  });

  test("an unidentified language proceeds as unknown in both, without blocking", async () => {
    const web = await analyzeAsWeb("hello world", "other");
    const cli = await runAnalysis({ sourceCode: "hello world" });

    expect(cli.ok).toBe(true);
    if (!cli.ok) return;
    expect(web.ok).toBe(true);
    if (web === undefined || !("run" in web)) return;
    expect(cli.language).toBe("unknown");
    expect(web.language).toBe("unknown");
    expect(cli.run.results.map(toPlainResult)).toEqual(
      web.run.results.map(toPlainResult),
    );
    expect(cli.run.results[0]?.status).toBe("not_applicable");
  });

  test("rule selection produces identical findings in both", async () => {
    const subject = unwrap(
      Subject.of({ sourceCode: VIOLATING_TS, language: "typescript" }),
    );
    const analyze = new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()]));
    const web = await analyze.execute({ subject, ruleIds: ["solid.srp"] });
    const cli = await runAnalysis({
      sourceCode: VIOLATING_TS,
      filename: "user-manager.ts",
      ruleIds: ["solid.srp"],
    });

    expect(cli.ok).toBe(true);
    if (!cli.ok) return;
    expect(cli.run.results.map(toPlainResult)).toEqual(
      web.results.map(toPlainResult),
    );
  });
});
