import { err, ok, type Result } from "../../shared/result.ts";

/**
 * What the corpus expects a rule to say about one fixture.
 *
 * Binary on purpose: the corpus pins down clear-cut cases a v1 heuristic
 * must get right. Ambiguous subjects (`uncertain`, `not_applicable`) are
 * the rules' own honesty mechanism, not corpus material — a fixture the
 * rules cannot decide is a bad fixture, not a passing test.
 */
export type CorpusExpectation = "violation" | "compliant";

export interface CorpusEntry {
  /** Stable, unique within the corpus, e.g. `"solid.srp.violation.god-class"`. */
  readonly id: string;
  /** Which rule this fixture judges, e.g. `"solid.srp"`. */
  readonly ruleId: string;
  /** The language the fixture is written in, e.g. `"typescript"`. */
  readonly language: string;
  /** Synthetic fixture source. Never customer code (#28). */
  readonly sourceCode: string;
  readonly expected: CorpusExpectation;
  /** What makes this fixture a case of `expected`, in one sentence. */
  readonly note: string;
}

export class InvalidCorpusError extends Error {
  override readonly name = "InvalidCorpusError";
}

/**
 * Guards the corpus gate itself: a versioned corpus with a duplicated id,
 * an empty fixture, or a non-binary expectation would silently measure
 * the wrong thing, so loading it fails loudly instead.
 */
export function validateCorpus(
  entries: readonly CorpusEntry[],
): Result<readonly CorpusEntry[], InvalidCorpusError> {
  if (entries.length === 0) {
    return err(new InvalidCorpusError("corpus must contain at least one entry."));
  }

  const seen = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const where = `entries[${index}]`;

    for (const [field, value] of [
      ["id", entry.id],
      ["ruleId", entry.ruleId],
      ["language", entry.language],
      ["sourceCode", entry.sourceCode],
      ["note", entry.note],
    ] as const) {
      if (value.trim().length === 0) {
        return err(new InvalidCorpusError(`${where}.${field} must not be empty.`));
      }
    }

    if (entry.expected !== "violation" && entry.expected !== "compliant") {
      return err(
        new InvalidCorpusError(
          `${where}.expected must be "violation" or "compliant".`,
        ),
      );
    }

    if (seen.has(entry.id)) {
      return err(
        new InvalidCorpusError(`duplicate corpus entry id "${entry.id}".`),
      );
    }

    seen.add(entry.id);
  }

  return ok([...entries]);
}
