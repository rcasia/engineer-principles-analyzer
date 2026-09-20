import { describe, expect, test } from "bun:test";
import { LANGUAGE_GUIDANCE } from "./offline-language.ts";
import { runAnalysis } from "./run-analysis.ts";

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

describe("runAnalysis", () => {
  test("analyzes a TypeScript file through the shared engine", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      filename: "user-manager.ts",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.language).toBe("typescript");
    expect(outcome.run.results).toHaveLength(1);
    const result = outcome.run.results[0];
    expect(result?.ruleId).toBe("solid.srp");
    expect(result?.status).toBe("violation");
    expect(result?.method).toBe("heuristic");
    expect(result?.confidence.value).toBe(0.55);
    expect(result?.language).toBe("typescript");
  });

  test("an explicit language wins over the filename", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      language: "typescript",
      filename: "user-manager.txt",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.language).toBe("typescript");
    expect(outcome.run.results[0]?.status).toBe("violation");
  });

  test("analyzes stdin source with an explicit language", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      language: "typescript",
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.results[0]?.status).toBe("violation");
  });

  test("rejects a language outside the judged set", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      language: "haskell",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("unknown-language");
    expect(outcome.failure.message).toBe(
      "Unknown language: haskell. Expected one of typescript, javascript, python, go, rust, java.",
    );
  });

  test("asks for a language when nothing names one", async () => {
    const outcome = await runAnalysis({ sourceCode: VIOLATING_TS });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("unknown-language");
    expect(outcome.failure.message).toBe(LANGUAGE_GUIDANCE);
    expect(outcome.failure.message).toBe(
      "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    );
  });

  test("reports an empty subject without echoing any source", async () => {
    const outcome = await runAnalysis({
      sourceCode: "   \n  ",
      filename: "empty.ts",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe("empty-source");
    expect(outcome.failure.message).toBe("sourceCode must not be empty.");
  });

  test("never includes submitted source in a failure message", async () => {
    const sensitive = "const greeting = 'zz-top-9999-quux';";
    const outcome = await runAnalysis({ sourceCode: sensitive });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.message).not.toContain("zz-top-9999-quux");
  });

  test("restricts the run to the requested rules", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      filename: "user-manager.ts",
      ruleIds: ["solid.srp"],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.results.map((result) => result.ruleId)).toEqual([
      "solid.srp",
    ]);
  });

  test("reports an unknown rule as unable_to_analyze, not as a crash", async () => {
    const outcome = await runAnalysis({
      sourceCode: VIOLATING_TS,
      filename: "user-manager.ts",
      ruleIds: ["nope.missing"],
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.results).toHaveLength(1);
    expect(outcome.run.results[0]?.status).toBe("unable_to_analyze");
    expect(outcome.run.results[0]?.ruleId).toBe("nope.missing");
  });
});
