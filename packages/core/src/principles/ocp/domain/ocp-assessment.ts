import {
  countBranchSignals,
  type BranchSignals,
} from "./branch-signals.ts";

/**
 * At least this many extension signals is read as modification-driven
 * extension pressure — new behaviour here most plausibly arrives by editing
 * existing branches.
 */
export const VIOLATION_SIGNAL_THRESHOLD = 3;

/** Exactly this many signals is ambiguous rather than a clear verdict either way. */
export const UNCERTAIN_SIGNAL_THRESHOLD = 2;

export type OcpVerdict = "compliant" | "violation" | "uncertain";

export interface OcpAssessment {
  readonly signals: BranchSignals;
  readonly verdict: OcpVerdict;
}

/** Classifies one subject's extension pressure from its signal count alone. */
export function assessOcp(sourceCode: string): OcpAssessment {
  const signals = countBranchSignals(sourceCode);

  return { signals, verdict: verdictFor(signals.total) };
}

function verdictFor(total: number): OcpVerdict {
  if (total >= VIOLATION_SIGNAL_THRESHOLD) {
    return "violation";
  }

  if (total >= UNCERTAIN_SIGNAL_THRESHOLD) {
    return "uncertain";
  }

  return "compliant";
}
