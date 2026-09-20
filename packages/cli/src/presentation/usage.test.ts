import { describe, expect, it } from "bun:test";
import {
  COMMAND_NAME,
  renderAnalyzeUsage,
  renderUnknownOption,
  renderUsage,
  renderVersion,
} from "./usage.ts";
import { VERSION } from "../version.ts";

describe("usage", () => {
  it("names the command as it is installed", () => {
    expect(COMMAND_NAME).toBe("principled");
  });

  it("reports dev as the version when running from source", () => {
    expect(VERSION).toBe("0.0.0-dev");
  });

  it("renders the version as name and number", () => {
    expect(renderVersion()).toBe("principled 0.0.0-dev");
  });

  it("documents every supported invocation", () => {
    const usage = renderUsage();

    expect(usage).toStartWith(
      "principled - analyze a codebase against engineering principles",
    );
    expect(usage).toContain("principled              List the known principles");
    expect(usage).toContain(
      "principled analyze [file] [--language <id>] [--format human|json|sarif] [--rule <id>] [--timing] [--stdin]",
    );
    expect(usage).toContain("principled --help       Show this help");
    expect(usage).toContain("principled --version    Show the version");
    expect(usage).toContain("no telemetry");
  });

  it("tells the user the catalog is empty on purpose", () => {
    expect(renderUsage()).toContain(
      "The principles catalog is empty while the analysis rules are being designed.",
    );
  });

  it("points at the repository for more detail", () => {
    expect(renderUsage()).toContain(
      "https://github.com/rcasia/principled",
    );
  });

  it("names the offending option and how to get help", () => {
    expect(renderUnknownOption("--wat")).toBe(
      "Unknown option: --wat\nRun 'principled --help' to see the available options.",
    );
  });

  it("documents the analyze invocation with formats and exit status", () => {
    const usage = renderAnalyzeUsage();

    expect(usage).toContain(
      "principled analyze - analyze one source file locally",
    );
    expect(usage).toContain("--language <id>");
    expect(usage).toContain("--rule <id>");
    expect(usage).toContain("human (default), json, or sarif");
    expect(usage).toContain('schema version "1"');
    expect(usage).toContain("0  analysis completed, no violations");
    expect(usage).toContain("1  analysis completed, at least one violation");
    expect(usage).toContain("2  no analysis happened");
  });
});
