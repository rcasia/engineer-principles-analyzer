import type { AnalysisRun } from "@principled/core";
import { VERSION } from "../version.ts";
import { ANALYSIS_OUTPUT_SCHEMA_VERSION } from "./schema-version.ts";

interface SarifRule {
  readonly id: string;
  readonly name: string;
  readonly fullDescription: { readonly text: string };
  readonly properties: { readonly ["principled/schemaVersion"]: string };
}

interface SarifResult {
  readonly ruleId: string;
  readonly level: "error" | "warning" | "note";
  readonly message: { readonly text: string };
  readonly locations: readonly [
    {
      readonly physicalLocation: {
        readonly artifactLocation: { readonly uri: string };
        readonly region: {
          readonly startLine: number;
          readonly endLine: number;
          readonly snippet?: { readonly text: string } | undefined;
        };
      };
    },
  ];
  readonly properties: {
    readonly ["principled/status"]: string;
    readonly ["principled/confidence"]: number;
    readonly ["principled/method"]: string;
    readonly ["principled/language"]: string;
    readonly ["principled/humanReviewRecommended"]: boolean;
  };
}

export interface SarifOutput {
  readonly $schema: string;
  readonly version: "2.1.0";
  readonly runs: readonly [
    {
      readonly tool: {
        readonly driver: {
          readonly name: string;
          readonly version: string;
          readonly informationUri: string;
          readonly rules: readonly SarifRule[];
        };
      };
      readonly results: readonly SarifResult[];
      readonly properties: { readonly ["principled/schemaVersion"]: string };
    },
  ];
}

function levelFor(status: string): SarifResult["level"] {
  if (status === "violation" || status === "unable_to_analyze") {
    return "error";
  }

  if (status === "uncertain") {
    return "warning";
  }

  return "note";
}

/**
 * SARIF 2.1.0 view of an analysis run for `--format sarif` (#44).
 *
 * Locations carry line numbers and the rule's own minimal evidence
 * excerpts — never the whole submitted file. No user, host, or telemetry
 * fields are emitted.
 */
export function toSarifOutput(
  run: AnalysisRun,
  options: { readonly filePath?: string | undefined } = {},
): SarifOutput {
  const uri = options.filePath ?? "input";
  const seen = new Map<string, string>();

  for (const result of run.results) {
    if (!seen.has(result.ruleId)) {
      seen.set(result.ruleId, result.explanation);
    }
  }

  const rules: SarifRule[] = [...seen.entries()].map(([id, text]) => ({
    id,
    name: id,
    fullDescription: { text },
    properties: { "principled/schemaVersion": ANALYSIS_OUTPUT_SCHEMA_VERSION },
  }));

  const results: SarifResult[] = run.results.map((result) => {
    const first = result.evidence[0];
    const region =
      first === undefined
        ? { startLine: 1, endLine: 1 }
        : {
            startLine: first.location.startLine,
            endLine: first.location.endLine,
            snippet: { text: first.excerpt },
          };

    return {
      ruleId: result.ruleId,
      level: levelFor(result.status),
      message: { text: result.explanation },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri },
            region,
          },
        },
      ],
      properties: {
        "principled/status": result.status,
        "principled/confidence": result.confidence.value,
        "principled/method": result.method,
        "principled/language": result.language,
        "principled/humanReviewRecommended": result.humanReviewRecommended,
      },
    };
  });

  return {
    $schema: "https://json.schemagrid.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "principled",
            version: VERSION,
            informationUri: "https://github.com/rcasia/principled",
            rules,
          },
        },
        results,
        properties: { "principled/schemaVersion": ANALYSIS_OUTPUT_SCHEMA_VERSION },
      },
    ],
  };
}
