import type { ClassDeclaration } from "./class-declaration.ts";
import { extractMethodNames } from "./class-members.ts";
import {
  classifyResponsibilityDomains,
  type DomainMatch,
} from "./responsibility-domain.ts";

/**
 * Below this many methods, method-name clustering is not a meaningful
 * signal either way — a two-method class cannot exhibit "three unrelated
 * domains", and reporting `compliant` would overstate confidence in a class
 * this rule barely looked at.
 */
export const MINIMUM_METHODS_TO_ASSESS = 3;

/** At least this many domain signals is read as concentrated responsibility. */
export const VIOLATION_DOMAIN_THRESHOLD = 3;

/** Exactly this many domain signals is ambiguous rather than a clear verdict either way. */
export const UNCERTAIN_DOMAIN_THRESHOLD = 2;

export type ClassVerdict = "compliant" | "violation" | "uncertain";

export type ClassAssessmentReason = "too_few_methods" | "domain_count";

export interface ClassAssessment {
  readonly declaration: ClassDeclaration;
  readonly methodCount: number;
  readonly domains: readonly DomainMatch[];
  readonly verdict: ClassVerdict;
  readonly reason: ClassAssessmentReason;
}

/**
 * Classifies one class's cohesion from its top-level methods' names alone.
 *
 * `language` selects how those names are read (see `extractMethodNames`):
 * the domain grouping and verdict thresholds below are identical for every
 * language — the rule's semantics stay language-independent, only the
 * method-shape interpretation varies (ADR-0031, #16). It is required rather
 * than defaulted so every caller states which interpretation it wants; a
 * defaulted empty string would leave an equivalent, untestable mutant behind
 * (any non-"python" default behaves identically).
 */
export function assessClass(
  declaration: ClassDeclaration,
  language: string,
): ClassAssessment {
  const methodNames = extractMethodNames(
    declaration.body,
    language,
    declaration.name,
  );
  const methodCount = methodNames.length;

  if (methodCount < MINIMUM_METHODS_TO_ASSESS) {
    return {
      declaration,
      methodCount,
      domains: [],
      verdict: "uncertain",
      reason: "too_few_methods",
    };
  }

  const domains = classifyResponsibilityDomains(methodNames);
  const verdict = verdictFor(domains.length);

  return { declaration, methodCount, domains, verdict, reason: "domain_count" };
}

function verdictFor(domainCount: number): ClassVerdict {
  if (domainCount >= VIOLATION_DOMAIN_THRESHOLD) {
    return "violation";
  }

  if (domainCount >= UNCERTAIN_DOMAIN_THRESHOLD) {
    return "uncertain";
  }

  return "compliant";
}
