import {
  countDependencySignals,
  type DependencySignals,
} from "./dependency-signals.ts";

/**
 * At least this many inversion signals is read as concrete coupling —
 * high-level logic that names infrastructure instead of an abstraction.
 */
export const VIOLATION_SIGNAL_THRESHOLD = 2;

/** Exactly one signal is ambiguous rather than a clear verdict either way. */
export const UNCERTAIN_SIGNAL_THRESHOLD = 1;

export type DipVerdict = "compliant" | "violation" | "uncertain";

export interface DipAssessment {
  readonly signals: DependencySignals;
  readonly verdict: DipVerdict;
}

/** Classifies one subject's concrete coupling from its signal count alone. */
export function assessDip(sourceCode: string): DipAssessment {
  const signals = countDependencySignals(sourceCode);

  return { signals, verdict: verdictFor(signals.total) };
}

function verdictFor(total: number): DipVerdict {
  if (total >= VIOLATION_SIGNAL_THRESHOLD) {
    return "violation";
  }

  if (total >= UNCERTAIN_SIGNAL_THRESHOLD) {
    return "uncertain";
  }

  return "compliant";
}
