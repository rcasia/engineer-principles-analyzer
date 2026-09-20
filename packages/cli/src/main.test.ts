import { describe, expect, it } from "bun:test";
import { EXIT_FINDINGS, EXIT_OK, EXIT_USAGE, main } from "./main.ts";
import type { MainDependencies } from "./main.ts";

function capture() {
  const out: string[] = [];
  const err: string[] = [];

  return {
    out,
    err,
    console: {
      out: (line: string) => out.push(line),
      err: (line: string) => err.push(line),
    },
  };
}

const VIOLATING_TS =
  "class UserManager {\n  save(user) {}\n  load(id) {}\n  send(email) {}\n  notify(user) {}\n  render(user) {}\n  display(user) {}\n}";

const COMPLIANT_TS =
  "class Calculator {\n  add(a, b) {}\n  subtract(a, b) {}\n  multiply(a, b) {}\n}";

function filesOf(files: Record<string, string>): MainDependencies {
  return {
    stdinIsTTY: true,
    readFile: async (path) => {
      const content = files[path];
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    readStdin: async () => {
      throw new Error("stdin is a terminal in these tests");
    },
  };
}

describe("main", () => {
  it("lists principles when given no arguments", async () => {
    const io = capture();

    const code = await main([], io.console);

    expect(code).toBe(0);
    expect(io.out).toEqual(["No principles are defined yet."]);
    expect(io.err).toEqual([]);
  });

  it.each(["--help", "-h"])("prints usage for %s", async (flag) => {
    const io = capture();

    const code = await main([flag], io.console);

    expect(code).toBe(0);
    expect(io.out).toHaveLength(1);
    expect(io.out[0]).toContain("Usage:");
    expect(io.out[0]).toContain("principled --version");
    expect(io.err).toEqual([]);
  });

  it.each(["--version", "-v"])("prints the version for %s", async (flag) => {
    const io = capture();

    const code = await main([flag], io.console);

    expect(code).toBe(0);
    expect(io.out).toEqual(["principled 0.0.0-dev"]);
    expect(io.err).toEqual([]);
  });

  it("reports an unknown option on stderr and exits 2", async () => {
    const io = capture();

    const code = await main(["--nope"], io.console);

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual([
      "Unknown option: --nope\nRun 'principled --help' to see the available options.",
    ]);
  });

  it("does not treat a bare argument as a flag", async () => {
    const io = capture();

    const code = await main(["somepath"], io.console);

    expect(code).toBe(2);
    expect(io.err[0]).toContain("Unknown option: somepath");
  });

  it("only inspects the first argument", async () => {
    const io = capture();

    const code = await main(["--version", "--help"], io.console);

    expect(code).toBe(0);
    expect(io.out).toEqual(["principled 0.0.0-dev"]);
  });

  it("exposes conventional exit codes", () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_FINDINGS).toBe(1);
    expect(EXIT_USAGE).toBe(2);
  });

  it("prints analyze help without touching input", async () => {
    const io = capture();

    const code = await main(["analyze", "--help"], io.console, filesOf({}));

    expect(code).toBe(0);
    expect(io.out).toHaveLength(1);
    expect(io.out[0]).toContain("principled analyze - analyze one source file locally");
    expect(io.out[0]).toContain("--format");
    expect(io.err).toEqual([]);
  });

  it("analyzes a file and exits 1 when a violation is found", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    expect(io.out).toHaveLength(1);
    expect(io.out[0]).toContain("violation solid.srp");
    expect(io.err).toEqual([]);
  });

  it("exits 0 when the analysis completes with no violations", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "calculator.ts"],
      io.console,
      filesOf({ "calculator.ts": COMPLIANT_TS }),
    );

    expect(code).toBe(0);
    expect(io.out[0]).toContain("compliant solid.srp");
  });

  it("reads piped source from stdin with an explicit language", async () => {
    const io = capture();

    const code = await main(["analyze", "--language", "typescript"], io.console, {
      stdinIsTTY: false,
      readStdin: async () => VIOLATING_TS,
      readFile: async () => {
        throw new Error("must not read files for stdin input");
      },
    });

    expect(code).toBe(1);
    expect(io.out[0]).toContain("violation solid.srp");
  });

  it("asks for a language when stdin has no filename to learn from", async () => {
    const io = capture();

    const code = await main(["analyze"], io.console, {
      stdinIsTTY: false,
      readStdin: async () => VIOLATING_TS,
      readFile: async () => {
        throw new Error("must not read files for stdin input");
      },
    });

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual([
      "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    ]);
  });

  it("lets --language win over the filename extension", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.txt", "--language", "typescript", "--format", "json"],
      io.console,
      filesOf({ "user-manager.txt": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    expect(JSON.parse(io.out[0] as string).subject).toEqual({
      language: "typescript",
      filePath: "user-manager.txt",
    });
  });

  it("rejects a language outside the judged set", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--language", "haskell"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual([
      "Unknown language: haskell. Expected one of typescript, javascript, python, go, rust, java.",
    ]);
  });

  it("refuses to wait on a terminal with no input", async () => {
    const io = capture();

    const code = await main(["analyze"], io.console, filesOf({}));

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual([
      "No input given. Provide a file path or pipe source via stdin.",
    ]);
  });

  it("names an unreadable file without leaking source", async () => {
    const io = capture();

    const code = await main(["analyze", "missing.ts"], io.console, filesOf({}));

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual(["Could not read file: missing.ts"]);
  });

  it("reports an unevaluable subject without echoing source", async () => {
    const io = capture();
    const sensitive = "const greeting = 'zz-top-9999-quux';\n";

    const code = await main(
      ["analyze", "notes.txt"],
      io.console,
      filesOf({ "notes.txt": sensitive }),
    );

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toHaveLength(1);
    expect(io.err[0]).not.toContain("zz-top-9999-quux");
    expect(io.err[0]).toBe(
      "Could not determine the programming language. Pass --language <id> (typescript, javascript, python, go, rust, java) or use a file with a known extension.",
    );
  });

  it("reports an empty file without echoing anything", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "empty.ts"],
      io.console,
      filesOf({ "empty.ts": "   \n  " }),
    );

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual(["sourceCode must not be empty."]);
  });

  it("emits versioned JSON with counts for --format json", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--format", "json"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    expect(io.err).toEqual([]);
    const output = JSON.parse(io.out[0] as string);
    expect(output.schemaVersion).toBe("1");
    expect(output.tool).toEqual({ name: "principled", version: "0.0.0-dev" });
    expect(output.status).toBe("completed");
    expect(output.subject).toEqual({
      language: "typescript",
      filePath: "user-manager.ts",
    });
    expect(output.ruleCount).toBe(1);
    expect(output.resultCounts).toEqual({ violation: 1 });
    expect(output.results[0].ruleId).toBe("solid.srp");
    expect(output.durationMs).toBeUndefined();
  });

  it("adds durationMs to JSON only with --timing", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--format", "json", "--timing"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    expect(typeof JSON.parse(io.out[0] as string).durationMs).toBe("number");
  });

  it("emits SARIF 2.1.0 for --format sarif", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--format", "sarif"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    const sarif = JSON.parse(io.out[0] as string);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("principled");
    expect(sarif.runs[0].properties).toEqual({ "principled/schemaVersion": "1" });
    expect(sarif.runs[0].results[0].ruleId).toBe("solid.srp");
    expect(sarif.runs[0].results[0].level).toBe("error");
  });

  it("rejects an unknown format without analyzing", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--format", "yaml"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(2);
    expect(io.out).toEqual([]);
    expect(io.err).toEqual([
      "Unknown format: yaml. Expected human, json, or sarif.",
    ]);
  });

  it("rejects an unknown analyze option", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "--nope"],
      io.console,
      filesOf({}),
    );

    expect(code).toBe(2);
    expect(io.err).toEqual([
      "Unknown option: --nope\nRun 'principled analyze --help' to see the available options.",
    ]);
  });

  it("restricts the run with a repeated --rule flag", async () => {
    const io = capture();

    const code = await main(
      ["analyze", "user-manager.ts", "--rule", "solid.srp", "--format", "json"],
      io.console,
      filesOf({ "user-manager.ts": VIOLATING_TS }),
    );

    expect(code).toBe(1);
    expect(
      JSON.parse(io.out[0] as string).results.map(
        (result: { ruleId: string }) => result.ruleId,
      ),
    ).toEqual(["solid.srp"]);
  });
});
