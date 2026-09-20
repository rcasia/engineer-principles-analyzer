import { assertTelemetrySafe } from "../../compliance/domain/sensitive-data.ts";
import { err, ok, type Result } from "../../shared/result.ts";

/**
 * Versioned, dated evaluation snapshots (#30, story #45).
 *
 * A snapshot is the public, reproducible record of one evaluation run: what
 * was measured, on which corpus, with which rules and models, how the sample
 * looked, and what the known limitations are. Snapshots are append-only
 * history — publishing a new one never rewrites an old claim.
 *
 * Deliberately there is no overall "code quality" score anywhere in this
 * module: quality is reported per rule and per language, with calibration,
 * evidence coverage and sample size alongside, so a finding can be read
 * with appropriate confidence instead of collapsed into one opaque number.
 *
 * Snapshots are built from controlled evaluation corpora only. Publishing
 * scans the snapshot with #28's forbidden-key guard, so private customer
 * code can never enter a public evaluation dataset by accident.
 */

/** One rule's measured quality in one language. */
export interface RuleLanguageQuality {
  readonly ruleId: string;
  readonly language: string;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly falsePositiveRate: number | null;
  readonly falseNegativeRate: number | null;
  /** Mean reported confidence, or `null` when the run did not record any. */
  readonly meanConfidence: number | null;
  /**
   * `|meanConfidence - precision|` where both are known, else `null` — the
   * visible calibration signal: near zero means the rule's confidence means
   * what it says.
   */
  readonly calibrationGap: number | null;
  /** Fraction of judgments that carried evidence, from `0` to `1`. */
  readonly evidenceCoverage: number;
  /** Judgments behind these numbers. */
  readonly sampleSize: number;
}

export interface EvaluationSnapshotProps {
  readonly principledVersion: string;
  /** Rule id to the exact rule version evaluated. */
  readonly ruleVersions: Readonly<Record<string, string>>;
  readonly corpusVersion: string;
  /** Calendar date of the run, `YYYY-MM-DD`. */
  readonly evaluatedAt: string;
  /** How the corpus was built and the numbers produced. */
  readonly methodology: string;
  /** Model/provider configuration, when a model materially contributed. */
  readonly modelConfiguration?: string | undefined;
  readonly entries: readonly RuleLanguageQuality[];
  /** Known limitations; at least one must be stated. */
  readonly limitations: readonly string[];
}

export interface EvaluationSnapshot extends EvaluationSnapshotProps {
  /** Snapshot of the props at publish time; entries and maps are copies. */
  readonly entries: readonly RuleLanguageQuality[];
}

export class InvalidEvaluationSnapshotError extends Error {
  override readonly name = "InvalidEvaluationSnapshotError";
}

const EVALUATED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): Result<never, InvalidEvaluationSnapshotError> {
  return err(new InvalidEvaluationSnapshotError(message));
}

function requireNonEmpty(value: string, field: string) {
  return value.trim().length === 0
    ? fail(`${field} must not be empty.`)
    : null;
}

function requireRate(
  value: number | null,
  field: string,
): Result<never, InvalidEvaluationSnapshotError> | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    return fail(`${field} must be between 0 and 1, or null.`);
  }

  return null;
}

/**
 * Validates one entry: identifiers present, rates in range, coverage in
 * range, a usable sample behind it.
 */
function validateEntry(
  entry: RuleLanguageQuality,
  index: number,
): Result<never, InvalidEvaluationSnapshotError> | null {
  const where = `entries[${index}]`;

  for (const [field, value] of [
    ["ruleId", entry.ruleId],
    ["language", entry.language],
  ] as const) {
    const failure = requireNonEmpty(value, `${where}.${field}`);

    if (failure !== null) {
      return failure;
    }
  }

  for (const [field, value] of [
    ["precision", entry.precision],
    ["recall", entry.recall],
    ["falsePositiveRate", entry.falsePositiveRate],
    ["falseNegativeRate", entry.falseNegativeRate],
    ["meanConfidence", entry.meanConfidence],
    ["calibrationGap", entry.calibrationGap],
  ] as const) {
    const failure = requireRate(value, `${where}.${field}`);

    if (failure !== null) {
      return failure;
    }
  }

  if (
    typeof entry.evidenceCoverage !== "number" ||
    Number.isNaN(entry.evidenceCoverage) ||
    entry.evidenceCoverage < 0 ||
    entry.evidenceCoverage > 1
  ) {
    return fail(`${where}.evidenceCoverage must be between 0 and 1.`);
  }

  if (!Number.isInteger(entry.sampleSize) || entry.sampleSize <= 0) {
    return fail(`${where}.sampleSize must be a positive integer.`);
  }

  if (
    entry.calibrationGap !== null &&
    (entry.precision === null || entry.meanConfidence === null)
  ) {
    return fail(
      `${where}.calibrationGap requires precision and meanConfidence.`,
    );
  }

  return null;
}

/**
 * Publishes a snapshot after validation. Fails (as `err`) on missing
 * versions, an undated run, an empty methodology, empty entries or missing
 * limitations — and throws #28's `TelemetryContainsSensitiveDataError` when
 * the snapshot smuggles customer source, prompts or findings, because that
 * must fail fast rather than become a publishable value.
 */
export function publishSnapshot(
  props: EvaluationSnapshotProps,
): Result<EvaluationSnapshot, InvalidEvaluationSnapshotError> {
  for (const [field, value] of [
    ["principledVersion", props.principledVersion],
    ["corpusVersion", props.corpusVersion],
    ["methodology", props.methodology],
  ] as const) {
    const failure = requireNonEmpty(value, field);

    if (failure !== null) {
      return failure;
    }
  }

  if (!EVALUATED_AT_PATTERN.test(props.evaluatedAt)) {
    return fail("evaluatedAt must be a YYYY-MM-DD date.");
  }

  if (props.entries.length === 0) {
    return fail("entries must contain at least one rule-language result.");
  }

  for (const [index, entry] of props.entries.entries()) {
    const failure = validateEntry(entry, index);

    if (failure !== null) {
      return failure;
    }
  }

  if (
    props.limitations.length === 0 ||
    props.limitations.some((limitation) => limitation.trim().length === 0)
  ) {
    return fail("limitations must state at least one known limitation.");
  }

  assertTelemetrySafe(props);

  return ok({
    ...props,
    ruleVersions: { ...props.ruleVersions },
    entries: props.entries.map((entry) => ({ ...entry })),
    limitations: [...props.limitations],
  });
}
