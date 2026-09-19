const MAX_EXCERPT_LENGTH = 120;

export interface SourceExcerpt {
  /** 1-based line number of the excerpt within the subject's source. */
  readonly lineNumber: number;
  /** Trimmed excerpt text, capped at 120 characters. */
  readonly text: string;
}

/**
 * First non-empty line of a subject's source, trimmed and capped.
 *
 * Jev answers carry no source locations, yet a `violation` must point at
 * something (`AnalysisResult` requires evidence). The honest choice is the
 * subject's own opening line — never a fabricated location — and the rule
 * discloses exactly that on every verdict. Total function: blank input,
 * which cannot arrive via `Subject` but can from a direct caller, falls back
 * to line 1 with empty text (which `Evidence.of` then rejects).
 */
export function excerptForEvidence(sourceCode: string): SourceExcerpt {
  const lines = sourceCode.split("\n");

  for (const [index, line] of lines.entries()) {
    const text = line.trim();

    if (text.length > 0) {
      return { lineNumber: index + 1, text: text.slice(0, MAX_EXCERPT_LENGTH) };
    }
  }

  return { lineNumber: 1, text: "" };
}
