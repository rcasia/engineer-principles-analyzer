import {
  bodyThrows,
  extractClasses,
  methodBodiesOf,
  type ClassInfo,
} from "./inheritance.ts";

/**
 * At least this many throwing overrides is read as substitutability risk —
 * code written against the parent cannot run against the child.
 */
export const VIOLATION_RISKY_OVERRIDE_THRESHOLD = 2;

/** Exactly one throwing override is ambiguous rather than a clear verdict either way. */
export const UNCERTAIN_RISKY_OVERRIDE_THRESHOLD = 1;

export type LspVerdict = "compliant" | "violation" | "uncertain" | "not_applicable";

export type LspAssessmentReason =
  | "no_inheritance"
  | "unresolved_parent"
  | "risky_override_count";

export interface RiskyOverride {
  readonly subclass: ClassInfo;
  readonly parentName: string;
  readonly methodName: string;
}

export interface UnresolvedSubclass {
  readonly subclass: ClassInfo;
  readonly parentName: string;
}

export interface LspAssessment {
  readonly verdict: LspVerdict;
  readonly reason: LspAssessmentReason;
  readonly riskyOverrides: readonly RiskyOverride[];
  readonly unresolved: readonly UnresolvedSubclass[];
  readonly resolvedSubclassCount: number;
}

/**
 * Classifies one subject's substitutability risk: for every subclass whose
 * parent is defined in the same subject, an overridden method that throws
 * where the parent did not is one risky override. Two or more is a
 * `violation`; exactly one is `uncertain`; none is `compliant`. A subject
 * with no inheritance at all is `not_applicable` — substitutability cannot
 * be judged without a hierarchy — and so is a verdict about subclasses
 * whose parents live outside the subject (`uncertain`, never `compliant`).
 */
export function assessLsp(sourceCode: string): LspAssessment {
  const classes = extractClasses(sourceCode);
  const byName = new Map(classes.map((info) => [info.name, info]));
  const subclasses = classes.filter((info) => info.parent !== undefined);

  if (subclasses.length === 0) {
    return {
      verdict: "not_applicable",
      reason: "no_inheritance",
      riskyOverrides: [],
      unresolved: [],
      resolvedSubclassCount: 0,
    };
  }

  const riskyOverrides: RiskyOverride[] = [];
  const unresolved: UnresolvedSubclass[] = [];
  let resolvedSubclassCount = 0;

  for (const subclass of subclasses) {
    const parentName = subclass.parent as string;
    const parent = byName.get(parentName);

    if (parent === undefined) {
      unresolved.push({ subclass, parentName });
      continue;
    }

    resolvedSubclassCount += 1;
    riskyOverrides.push(...riskyOverridesOf(subclass, parent));
  }

  if (resolvedSubclassCount === 0) {
    return {
      verdict: "uncertain",
      reason: "unresolved_parent",
      riskyOverrides,
      unresolved,
      resolvedSubclassCount,
    };
  }

  return {
    verdict: verdictFor(riskyOverrides.length),
    reason: "risky_override_count",
    riskyOverrides,
    unresolved,
    resolvedSubclassCount,
  };
}

function riskyOverridesOf(
  subclass: ClassInfo,
  parent: ClassInfo,
): readonly RiskyOverride[] {
  const parentMethods = new Set(
    methodBodiesOf(parent.body).map((method) => method.name),
  );

  return methodBodiesOf(subclass.body)
    .filter(
      (method) => parentMethods.has(method.name) && bodyThrows(method.body),
    )
    .map((method) => ({
      subclass,
      parentName: parent.name,
      methodName: method.name,
    }));
}

function verdictFor(
  riskyCount: number,
): "compliant" | "violation" | "uncertain" {
  if (riskyCount >= VIOLATION_RISKY_OVERRIDE_THRESHOLD) {
    return "violation";
  }

  if (riskyCount >= UNCERTAIN_RISKY_OVERRIDE_THRESHOLD) {
    return "uncertain";
  }

  return "compliant";
}
