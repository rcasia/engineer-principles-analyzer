import { describe, expect, test } from "bun:test";
import { AnalyzeSubject, InMemoryRuleCatalog, SrpRule } from "@principled/core";
import { unwrap } from "@principled/core";
import { Subject } from "@principled/core";
import { renderFindings } from "./render-analysis.ts";

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

describe("renderFindings", () => {
  test("says so when no rule ran", () => {
    expect(renderFindings([])).toBe(
      "No rules were available to evaluate this input.",
    );
  });

  test("renders one block per result with status and rationale", async () => {
    const analyze = new AnalyzeSubject(
      new InMemoryRuleCatalog([new SrpRule()]),
    );
    const run = await analyze.execute({
      subject: unwrap(
        Subject.of({ sourceCode: VIOLATING_TS, language: "typescript" }),
      ),
    });

    const text = renderFindings(run.results);

    expect(text).toContain("violation solid.srp (55% confidence, heuristic)");
    expect(text).toContain(
      "Found method-name evidence of concentrated responsibility.",
    );
    expect(text).toContain("evidence lines 1-8: class UserManager { … }");
    expect(text).toContain("suggested fix: Consider splitting responsibilities:");
    expect(text).toContain("human review recommended");
  });
});
