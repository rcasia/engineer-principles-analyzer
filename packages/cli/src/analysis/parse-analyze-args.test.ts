import { describe, expect, test } from "bun:test";
import { parseAnalyzeArgs } from "./parse-analyze-args.ts";

describe("parseAnalyzeArgs", () => {
  test("defaults every option when no args are given", () => {
    expect(parseAnalyzeArgs([])).toEqual({
      ok: true,
      options: {
        filePath: undefined,
        fromStdin: false,
        format: "human",
        language: undefined,
        ruleIds: undefined,
        timing: false,
      },
    });
  });

  test("takes a single positional file path", () => {
    const parsed = parseAnalyzeArgs(["user-manager.ts"]);

    expect(parsed).toEqual({
      ok: true,
      options: {
        filePath: "user-manager.ts",
        fromStdin: false,
        format: "human",
        language: undefined,
        ruleIds: undefined,
        timing: false,
      },
    });
  });

  test("reads --stdin as piped input", () => {
    const parsed = parseAnalyzeArgs(["--stdin"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.fromStdin).toBe(true);
    expect(parsed.options.filePath).toBeUndefined();
  });

  test("reads a bare dash as piped input", () => {
    const parsed = parseAnalyzeArgs(["-"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.fromStdin).toBe(true);
    expect(parsed.options.filePath).toBeUndefined();
  });

  test("reads --timing", () => {
    const parsed = parseAnalyzeArgs(["--timing", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.timing).toBe(true);
    expect(parsed.options.filePath).toBe("a.ts");
  });

  test("reads --format with a separate value", () => {
    const parsed = parseAnalyzeArgs(["--format", "json", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.format).toBe("json");
    expect(parsed.options.filePath).toBe("a.ts");
  });

  test("reads --format with an equals value", () => {
    const parsed = parseAnalyzeArgs(["--format=sarif", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.format).toBe("sarif");
    expect(parsed.options.filePath).toBe("a.ts");
  });

  test("reads an explicit human format", () => {
    const parsed = parseAnalyzeArgs(["--format", "human", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.format).toBe("human");
  });

  test("rejects --format with no value at the end", () => {
    expect(parseAnalyzeArgs(["--format"])).toEqual({
      ok: false,
      message: "Missing value for --format. Expected human, json, or sarif.",
    });
  });

  test("rejects --format followed by another flag", () => {
    expect(parseAnalyzeArgs(["--format", "--rule", "solid.srp"])).toEqual({
      ok: false,
      message: "Missing value for --format. Expected human, json, or sarif.",
    });
  });

  test("rejects an unknown format", () => {
    expect(parseAnalyzeArgs(["--format", "yaml"])).toEqual({
      ok: false,
      message: "Unknown format: yaml. Expected human, json, or sarif.",
    });
  });

  test("rejects an unknown equals format", () => {
    expect(parseAnalyzeArgs(["--format=yaml"])).toEqual({
      ok: false,
      message: "Unknown format: yaml. Expected human, json, or sarif.",
    });
  });

  test("reads --language with a separate value", () => {
    const parsed = parseAnalyzeArgs(["--language", "python", "a.py"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.language).toBe("python");
    expect(parsed.options.filePath).toBe("a.py");
  });

  test("reads --language with an equals value", () => {
    const parsed = parseAnalyzeArgs(["--language=go", "a.go"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.language).toBe("go");
    expect(parsed.options.filePath).toBe("a.go");
  });

  test("rejects --language with no value at the end", () => {
    expect(parseAnalyzeArgs(["--language"])).toEqual({
      ok: false,
      message:
        "Missing value for --language. Expected one of typescript, javascript, python, go, rust, java, unknown.",
    });
  });

  test("rejects --language followed by another flag", () => {
    expect(parseAnalyzeArgs(["--language", "--format", "json"])).toEqual({
      ok: false,
      message:
        "Missing value for --language. Expected one of typescript, javascript, python, go, rust, java, unknown.",
    });
  });

  test("reads --rule with a separate value", () => {
    const parsed = parseAnalyzeArgs(["--rule", "solid.srp", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.ruleIds).toEqual(["solid.srp"]);
    expect(parsed.options.filePath).toBe("a.ts");
  });

  test("reads --rule with an equals value", () => {
    const parsed = parseAnalyzeArgs(["--rule=solid.srp", "a.ts"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.ruleIds).toEqual(["solid.srp"]);
  });

  test("splits a comma-separated rule list and trims whitespace", () => {
    const parsed = parseAnalyzeArgs(["--rule", " solid.srp , solid.ocp "]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.ruleIds).toEqual(["solid.srp", "solid.ocp"]);
  });

  test("accumulates repeated --rule flags in order", () => {
    const parsed = parseAnalyzeArgs([
      "--rule",
      "solid.srp",
      "--rule=nope.missing",
    ]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.ruleIds).toEqual(["solid.srp", "nope.missing"]);
  });

  test("rejects --rule with no value at the end", () => {
    expect(parseAnalyzeArgs(["--rule"])).toEqual({
      ok: false,
      message:
        "Missing value for --rule. Expected a rule id such as solid.srp.",
    });
  });

  test("rejects --rule followed by another flag", () => {
    expect(parseAnalyzeArgs(["--rule", "--format", "json"])).toEqual({
      ok: false,
      message:
        "Missing value for --rule. Expected a rule id such as solid.srp.",
    });
  });

  test("rejects a --rule value that is only commas and spaces", () => {
    expect(parseAnalyzeArgs(["--rule", " , "])).toEqual({
      ok: false,
      message:
        "Missing value for --rule. Expected a rule id such as solid.srp.",
    });
  });

  test("rejects an unknown long option", () => {
    expect(parseAnalyzeArgs(["--nope"])).toEqual({
      ok: false,
      message:
        "Unknown option: --nope\nRun 'principled analyze --help' to see the available options.",
    });
  });

  test("rejects a second positional file", () => {
    expect(parseAnalyzeArgs(["a.ts", "b.ts"])).toEqual({
      ok: false,
      message:
        "Unexpected argument: b.ts\nRun 'principled analyze --help' to see the available options.",
    });
  });

  test("keeps a file and --stdin together for the caller to reject", () => {
    const parsed = parseAnalyzeArgs(["a.ts", "--stdin"]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.filePath).toBe("a.ts");
    expect(parsed.options.fromStdin).toBe(true);
  });

  test("combines flags in any order", () => {
    const parsed = parseAnalyzeArgs([
      "--timing",
      "--format=json",
      "--language",
      "typescript",
      "--rule=solid.srp",
      "--stdin",
    ]);

    expect(parsed).toEqual({
      ok: true,
      options: {
        filePath: undefined,
        fromStdin: true,
        format: "json",
        language: "typescript",
        ruleIds: ["solid.srp"],
        timing: true,
      },
    });
  });
});
