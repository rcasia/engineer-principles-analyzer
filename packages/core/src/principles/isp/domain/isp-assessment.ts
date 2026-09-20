import {
  extractInterfaces,
  type InterfaceInfo,
} from "./interface-declaration.ts";

/**
 * At least this many members is read as a fat interface — more operations
 * than one consumer plausibly needs from a single abstraction.
 */
export const VIOLATION_MEMBER_THRESHOLD = 7;

/** Exactly this many members is ambiguous rather than a clear verdict either way. */
export const UNCERTAIN_MEMBER_THRESHOLD = 5;

export type IspVerdict =
  | "compliant"
  | "violation"
  | "uncertain"
  | "not_applicable";

export type IspAssessmentReason = "no_interface" | "member_count";

export interface IspAssessment {
  readonly verdict: IspVerdict;
  readonly reason: IspAssessmentReason;
  /** Every interface found, broadest first. */
  readonly interfaces: readonly InterfaceInfo[];
  /** The interfaces behind a violation/uncertain verdict; all of them behind compliant. */
  readonly highlighted: readonly InterfaceInfo[];
}

/**
 * Classifies one subject's interface breadth. One `AnalysisResult` per
 * subject, not per interface: the worst verdict among the subject's
 * interfaces wins (any `violation` outranks any `uncertain`, which
 * outranks `compliant`), and evidence is attached only for the interfaces
 * behind that verdict. A subject with no interface-shaped construct at
 * all is `not_applicable` — never `compliant`.
 */
export function assessIsp(sourceCode: string): IspAssessment {
  const interfaces = [...extractInterfaces(sourceCode)].sort(
    (a, b) => b.memberCount - a.memberCount,
  );

  if (interfaces.length === 0) {
    return {
      verdict: "not_applicable",
      reason: "no_interface",
      interfaces,
      highlighted: [],
    };
  }

  const violating = interfaces.filter(
    (info) => info.memberCount >= VIOLATION_MEMBER_THRESHOLD,
  );

  if (violating.length > 0) {
    return {
      verdict: "violation",
      reason: "member_count",
      interfaces,
      highlighted: violating,
    };
  }

  const uncertain = interfaces.filter(
    (info) => info.memberCount >= UNCERTAIN_MEMBER_THRESHOLD,
  );

  if (uncertain.length > 0) {
    return {
      verdict: "uncertain",
      reason: "member_count",
      interfaces,
      highlighted: uncertain,
    };
  }

  return {
    verdict: "compliant",
    reason: "member_count",
    interfaces,
    highlighted: interfaces,
  };
}
