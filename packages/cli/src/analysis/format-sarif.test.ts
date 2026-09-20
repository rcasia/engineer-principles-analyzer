import { describe, expect, test } from "bun:test";
import { AnalyzeSubject, InMemoryRuleCatalog, SrpRule } from "@principled/core";
import { unwrap } from "@principled/core";
import { Subject } from "@principled/core";
import { toSarifOutput } from "./format-sarif.ts";

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

async function violatingRun() {
  const analyze = new AnalyzeSubject(new InMemoryRuleCatalog([new SrpRule()]));
  return analyze.execute({
    subject: unwrap(Subject.of({ sourceCode: VIOLATING_TS, language: "typescript" })),
  });
}

describe("toSarifOutput", () => {
  test("produces a SARIF 2.1.0 document with the schema version", async () => {
    const sarif = toSarifOutput(await violatingRun(), {
      filePath: "user-manager.ts",
    });

    expect(sarif.$schema).toBe("https://json.schemagrid.org/sarif-2.1.0.json");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    const run = sarif.runs[0];
    expect(run?.tool.driver.name).toBe("principled");
    expect(run?.tool.driver.version).toBe("0.0.0-dev");
    expect(run?.tool.driver.informationUri).toBe(
      "https://github.com/rcasia/principled",
    );
    expect(run?.properties).toEqual({ "principled/schemaVersion": "1" });
    expect(run?.tool.driver.rules).toEqual([
      {
        id: "solid.srp",
        name: "solid.srp",
        fullDescription: {
          text: "Found method-name evidence of concentrated responsibility. " +
            '"UserManager" touches 3 responsibility domains: persistence (save, load); communication (send, notify); presentation (render, display).',
        },
        properties: { "principled/schemaVersion": "1" },
      },
    ]);
  });

  test("maps a violation to an error-level result with evidence", async () => {
    const sarif = toSarifOutput(await violatingRun(), {
      filePath: "user-manager.ts",
    });
    const result = sarif.runs[0]?.results[0];

    expect(result?.ruleId).toBe("solid.srp");
    expect(result?.level).toBe("error");
    expect(result?.message.text).toBe(
      "Found method-name evidence of concentrated responsibility. " +
        '"UserManager" touches 3 responsibility domains: persistence (save, load); communication (send, notify); presentation (render, display).',
    );
    expect(result?.locations[0]?.physicalLocation.artifactLocation).toEqual({
      uri: "user-manager.ts",
    });
    expect(
      result?.locations[0]?.physicalLocation.region.startLine,
    ).toBe(1);
    expect(
      result?.locations[0]?.physicalLocation.region.snippet?.text,
    ).toBe("class UserManager { … }");
    expect(result?.properties["principled/status"]).toBe("violation");
    expect(result?.properties["principled/confidence"]).toBe(0.55);
    expect(result?.properties["principled/method"]).toBe("heuristic");
    expect(result?.properties["principled/language"]).toBe("typescript");
    expect(result?.properties["principled/humanReviewRecommended"]).toBe(true);
  });

  test("labels the artifact as input when no file path is known", async () => {
    const sarif = toSarifOutput(await violatingRun());

    expect(
      sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation.artifactLocation,
    ).toEqual({ uri: "input" });
  });

  test("emits no telemetry or user-tracking fields", async () => {
    const raw = JSON.stringify(toSarifOutput(await violatingRun()));

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
});
