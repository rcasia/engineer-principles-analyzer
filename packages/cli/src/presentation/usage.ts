import { VERSION } from "../version.ts";

export const COMMAND_NAME = "principled";

export function renderVersion(): string {
  return `${COMMAND_NAME} ${VERSION}`;
}

export function renderUsage(): string {
  return `${COMMAND_NAME} - analyze a codebase against engineering principles

Usage:
  ${COMMAND_NAME}              List the known principles
  ${COMMAND_NAME} --help       Show this help
  ${COMMAND_NAME} --version    Show the version

The principles catalog is empty while the analysis rules are being designed.
See https://github.com/rcasia/engineer-principles-analyzer`;
}

export function renderUnknownOption(option: string): string {
  return `Unknown option: ${option}\nRun '${COMMAND_NAME} --help' to see the available options.`;
}
