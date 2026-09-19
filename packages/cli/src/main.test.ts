import { describe, expect, it } from "bun:test";
import { EXIT_OK, EXIT_USAGE, main } from "./main.ts";

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
    expect(EXIT_USAGE).toBe(2);
  });
});
