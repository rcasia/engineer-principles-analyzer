import { ANALYSIS_OUTPUT_SCHEMA_VERSION } from "../analysis/schema-version.ts";
import { VERSION } from "../version.ts";

export const COMMAND_NAME = "principled";

export function renderVersion(): string {
  return `${COMMAND_NAME} ${VERSION}`;
}

export function renderUsage(): string {
  return `${COMMAND_NAME} - analyze a codebase against engineering principles

Usage:
  ${COMMAND_NAME}              List the known principles
  ${COMMAND_NAME} analyze [file] [--language <id>] [--format human|json|sarif] [--rule <id>] [--timing] [--stdin]
                           Analyze one source file with the shared rule engine
  ${COMMAND_NAME} --help       Show this help
  ${COMMAND_NAME} --version    Show the version

Local only: analysis runs on this machine with no account, no network and
no telemetry. Run '${COMMAND_NAME} analyze --help' for the analyze options.
The principles catalog is empty while the analysis rules are being designed.
See https://github.com/rcasia/principled`;
}

export function renderAnalyzeUsage(): string {
  return `${COMMAND_NAME} analyze - analyze one source file locally

Usage:
  ${COMMAND_NAME} analyze [file] [--language <id>] [--rule <id> ...] [--format human|json|sarif] [--timing] [--stdin]

Input (exactly one):
  [file]          Read source from this file. A known extension
                  (.ts, .js, .py, .go, .rs, .java, ...) names the language.
  --stdin, -      Read source from stdin instead. Used when no file is given.

Options:
  --language <id> typescript, javascript, python, go, rust, or java.
                  Wins over the filename extension; required when the
                  filename names no known language (for example stdin).
                  The web product judges content with a model instead, so
                  findings match it whenever both settle on one language.
  --rule <id>     Only run this rule (repeat or comma-separate for several).
                  Default: every registered rule runs.
  --format <name> human (default), json, or sarif. json and sarif carry
                  schema version "${ANALYSIS_OUTPUT_SCHEMA_VERSION}" for machine consumers.
  --timing        Include analysis duration (json: durationMs field).

Exit status:
  0  analysis completed, no violations
  1  analysis completed, at least one violation
  2  no analysis happened (bad flags, unreadable input, or unevaluable subject)

Examples:
  ${COMMAND_NAME} analyze src/server.ts
  ${COMMAND_NAME} analyze src/server.ts --format json --rule solid.srp
  cat src/server.py | ${COMMAND_NAME} analyze --language python --format sarif > results.sarif`;
}

export function renderUnknownOption(option: string): string {
  return `Unknown option: ${option}\nRun '${COMMAND_NAME} --help' to see the available options.`;
}
