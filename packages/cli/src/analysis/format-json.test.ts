import { describe, expect, test } from "bun:test";
import { AnalyzeSubject, InMemoryRuleCatalog, SrpRule } from "@principled/core";
import { unwrap } from "@principled/core";
import { Subject } from "@principled/core";
import { toJsonOutput } from "./format-json.ts";

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

async function violatingRun() {
  const analyze = new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()]));
  return analyze.execute({
    subject: unwrap(Subject.of({ sourceCode: VIOLATING_TS, language: "typescript" })),
  });
}

describe("toJsonOutput", () => {
  test("carries the versioned schema envelope with counts", async () => {
    const output = toJsonOutput(await violatingRun(), "typescript", {
      filePath: "user-manager.ts",
    });

    expect(output.schemaVersion).toBe("1");
    expect(output.tool).toEqual({ name: "principled", version: "0.0.0-dev" });
    expect(output.status).toBe("completed");
    expect(output.subject).toEqual({
      language: "typescript",
      filePath: "user-manager.ts",
    });
    expect(output.ruleCount).toBe(1);
    expect(output.resultCounts).toEqual({ violation: 1 });
    expect(output.results).toHaveLength(1);
    expect(output.results[0]?.ruleId).toBe("solid.srp");
    expect(output.results[0]?.status).toBe("violation");
    expect(output.results[0]?.confidence).toBe(0.55);
    expect(output.results[0]?.method).toBe("heuristic");
    expect(output.results[0]?.humanReviewRecommended).toBe(true);
    expect(output.results[0]?.explanation).toBe(
      "Found method-name evidence of concentrated responsibility. " +
        '"UserManager" touches 3 responsibility domains: persistence (save, load); communication (send, notify); presentation (render, display).',
    );
  });

  test("omits duration unless explicitly requested", async () => {
    const run = await violatingRun();

    expect(toJsonOutput(run, "typescript").durationMs).toBeUndefined();
    expect(
      toJsonOutput(run, "typescript", { durationMs: 12 }).durationMs,
    ).toBe(12);
  });

  test("emits no telemetry or user-tracking fields", async () => {
    const raw = JSON.stringify(toJsonOutput(await violatingRun(), "typescript"));

    for (const field of [
      "user",
      "telemetry",
      "tracking",
      "hostname",
      "username",
      "email",
      "token",
    ]) {
      expect(raw).not.toContain(`"${field}"`);
    }
  });

  test("serializes deterministically for identical runs", async () => {
    const first = JSON.stringify(toJsonOutput(await violatingRun(), "typescript"));
    const second = JSON.stringify(toJsonOutput(await violatingRun(), "typescript"));

    expect(first).toBe(second);
  });
});
