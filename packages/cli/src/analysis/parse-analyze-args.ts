export interface AnalyzeOptions {
  filePath: string | undefined;
  fromStdin: boolean;
  format: string;
  language: string | undefined;
  ruleIds: string[] | undefined;
  timing: boolean;
}

export type ParseAnalyzeArgsResult =
  | { readonly ok: true; readonly options: AnalyzeOptions }
  | { readonly ok: false; readonly message: string };

const FORMATS: ReadonlySet<string> = new Set(["human", "json", "sarif"]);

export function parseAnalyzeArgs(
  args: readonly string[],
): ParseAnalyzeArgsResult {
  const options: AnalyzeOptions = { filePath: undefined, fromStdin: false, format: "human", language: undefined, ruleIds: undefined, timing: false };

  let index = 0;
  while (index < args.length) {
    const arg = args[index] as string;

    if (arg === "--stdin") {
      options.fromStdin = true;
      index += 1;
      continue;
    }

    if (arg === "--timing") {
      options.timing = true;
      index += 1;
      continue;
    }

    if (arg === "--format" || arg.startsWith("--format=")) {
      const value =
        arg === "--format" ? args[index + 1] : arg.slice("--format=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --format. Expected human, json, or sarif." };
      }
      if (!FORMATS.has(value)) {
        return { ok: false, message: `Unknown format: ${value}. Expected human, json, or sarif.` };
      }
      options.format = value;
      index += arg === "--format" ? 2 : 1;
      continue;
    }

    if (arg === "--language" || arg.startsWith("--language=")) {
      const value =
        arg === "--language" ? args[index + 1] : arg.slice("--language=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --language. Expected one of typescript, javascript, python, go, rust, java, unknown." };
      }
      options.language = value;
      index += arg === "--language" ? 2 : 1;
      continue;
    }

    if (arg === "--rule" || arg.startsWith("--rule=")) {      const value =
        arg === "--rule" ? args[index + 1] : arg.slice("--rule=".length);
      if (value === undefined || value.startsWith("--")) {
        return { ok: false, message: "Missing value for --rule. Expected a rule id such as solid.srp." };
      }
      const ids = value.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
      if (ids.length === 0) {
        return { ok: false, message: "Missing value for --rule. Expected a rule id such as solid.srp." };
      }
      options.ruleIds = [...(options.ruleIds ?? []), ...ids];
      index += arg === "--rule" ? 2 : 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ok: false, message: `Unknown option: ${arg}\nRun 'principled analyze --help' to see the available options.` };
    }

    if (options.filePath !== undefined) {
      return { ok: false, message: `Unexpected argument: ${arg}\nRun 'principled analyze --help' to see the available options.` };
    }

    if (arg === "-") {
      options.fromStdin = true;
    } else {
      options.filePath = arg;
    }
    index += 1;
  }

  return { ok: true, options };
}
