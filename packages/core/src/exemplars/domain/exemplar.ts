import { err, ok, type Result } from "../../shared/result.ts";

/**
 * Public code exemplars and instructive cases (#32, story #46).
 *
 * An educational, opt-in showcase of exemplary single-file code and
 * instructive failures — never a developer ranking or performance instrument:
 *
 * - Named repositories and files require explicit owner opt-in; without
 *   consent there is no publication, only an error.
 * - The type has no developer, author, score or rank field, so an
 *   employment/performance ranking cannot be expressed, let alone published.
 * - Every entry carries its methodology, analysis version, evidence and
 *   limitations on its face, and the owner can request correction or removal
 *   at any time.
 * - Entries reference public code by permalink (`sourceRef`); raw customer
 *   source never enters this module — there is no field that could hold it.
 *   Free-text fields pass through human/community review before publication
 *   (the consensus model below), which is where personal data in prose is
 *   caught; #28's telemetry guard does not apply because an entry is
 *   public-by-consent content, not a silent measurement.
 *
 * Pure domain module: no I/O. Email/consent delivery lives outside core.
 */

export const EXEMPLAR_CATEGORIES = [
  "exemplary-srp",
  "exemplary-ocp",
  "exemplary-lsp",
  "exemplary-isp",
  "exemplary-dip",
  "instructive-violation",
  "ambiguous-case",
  "refactoring-improvement",
] as const;

export type ExemplarCategory = (typeof EXEMPLAR_CATEGORIES)[number];

export type ExemplarStatus = "published" | "correction-requested" | "removed";

export interface ExemplarSubmission {
  readonly title: string;
  readonly category: ExemplarCategory;
  readonly ruleId: string;
  readonly language: string;
  /** Permalink to the public code; never raw pasted source. */
  readonly sourceRef: string;
  /** Owner who consented, e.g. a repository owner or organization. */
  readonly owner: string;
  /** License/provenance of the referenced code, e.g. an SPDX identifier. */
  readonly license: string;
  /** Versioned evaluation methodology the entry was judged under. */
  readonly methodology: string;
  /** Principled version and rule version that produced the analysis. */
  readonly analysisVersion: string;
  /** Must be `true`: the owner's explicit opt-in to publish this entry. */
  readonly ownerConsent: boolean;
  /** Finding descriptions supporting the entry; never customer code. */
  readonly evidence: readonly string[];
  /** What the analysis cannot show; at least one must be stated. */
  readonly limitations: readonly string[];
}

export interface PublishedExemplar extends ExemplarSubmission {
  readonly status: ExemplarStatus;
  readonly correctionNote?: string | undefined;
}

export class InvalidExemplarError extends Error {
  override readonly name = "InvalidExemplarError";
}

function fail(message: string): Result<never, InvalidExemplarError> {
  return err(new InvalidExemplarError(message));
}

/**
 * Publishes an owner-consented entry. Anything else — missing consent,
 * missing provenance, missing methodology/version/evidence/limitations —
 * stays unpublished with the reason why.
 */
export function requestPublication(
  submission: ExemplarSubmission,
): Result<PublishedExemplar, InvalidExemplarError> {
  if (submission.ownerConsent !== true) {
    return fail("ownerConsent must be an explicit opt-in to publish.");
  }

  if (
    !EXEMPLAR_CATEGORIES.includes(submission.category as ExemplarCategory)
  ) {
    return fail(`category must be one of ${EXEMPLAR_CATEGORIES.join(", ")}.`);
  }

  for (const [field, value] of [
    ["title", submission.title],
    ["ruleId", submission.ruleId],
    ["language", submission.language],
    ["sourceRef", submission.sourceRef],
    ["owner", submission.owner],
    ["license", submission.license],
    ["methodology", submission.methodology],
    ["analysisVersion", submission.analysisVersion],
  ] as const) {
    if (value.trim().length === 0) {
      return fail(`${field} must not be empty.`);
    }
  }

  if (
    submission.evidence.length === 0 ||
    submission.evidence.some((item) => item.trim().length === 0)
  ) {
    return fail("evidence must state at least one finding description.");
  }

  if (
    submission.limitations.length === 0 ||
    submission.limitations.some((item) => item.trim().length === 0)
  ) {
    return fail("limitations must state at least one known limitation.");
  }

  return ok({ ...submission, status: "published" });
}

/**
 * Records the owner's correction request. Only live entries can be
 * corrected; removed ones stay removed.
 */
export function requestCorrection(
  exemplar: PublishedExemplar,
  note: string,
): Result<PublishedExemplar, InvalidExemplarError> {
  if (exemplar.status === "removed") {
    return fail("removed entries cannot be corrected; they stay removed.");
  }

  if (note.trim().length === 0) {
    return fail("correction note must not be empty.");
  }

  return ok({ ...exemplar, status: "correction-requested", correctionNote: note });
}

/**
 * Honours the owner's removal request. Removal is terminal.
 */
export function requestRemoval(
  exemplar: PublishedExemplar,
): Result<PublishedExemplar, InvalidExemplarError> {
  if (exemplar.status === "removed") {
    return fail("entry is already removed.");
  }

  const { correctionNote: _dropped, ...rest } = exemplar;

  return ok({ ...rest, status: "removed" });
}
