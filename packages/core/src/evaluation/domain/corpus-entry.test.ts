import { describe, expect, test } from "bun:test";
import {
  InvalidCorpusError,
  validateCorpus,
  type CorpusEntry,
} from "./corpus-entry.ts";

function entryOf(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "solid.srp.violation.god-class",
    ruleId: "solid.srp",
    language: "typescript",
    sourceCode: "class A {}",
    expected: "violation",
    note: "A class touching three responsibility domains.",
    ...overrides,
  };
}

describe("validateCorpus", () => {
  test("accepts a well-formed corpus and returns a copy", () => {
    const entries = [entryOf()];
    const result = validateCorpus(entries);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toEqual(entries);
      expect(result.value).not.toBe(entries);
    }
  });

  test("rejects an empty corpus", () => {
    const result = validateCorpus([]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("corpus must contain at least one entry.");
    }
  });

  test("rejects an entry with an empty id", () => {
    const result = validateCorpus([entryOf({ id: "  " })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[0].id must not be empty.");
    }
  });

  test("rejects an entry with an empty ruleId", () => {
    const result = validateCorpus([entryOf({ ruleId: "" })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[0].ruleId must not be empty.");
    }
  });

  test("rejects an entry with an empty language", () => {
    const result = validateCorpus([entryOf({ language: "" })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[0].language must not be empty.");
    }
  });

  test("rejects an entry with blank sourceCode", () => {
    const result = validateCorpus([entryOf({ sourceCode: "  \n " })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[0].sourceCode must not be empty.");
    }
  });

  test("rejects an entry with an empty note", () => {
    const result = validateCorpus([entryOf({ note: "" })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[0].note must not be empty.");
    }
  });

  test("rejects a non-binary expectation", () => {
    const result = validateCorpus([
      entryOf({ expected: "uncertain" as unknown as "violation" }),
    ]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe(
        'entries[0].expected must be "violation" or "compliant".',
      );
    }
  });

  test("rejects a duplicated id and reports it", () => {
    const result = validateCorpus([
      entryOf(),
      entryOf({ note: "A second fixture reusing the id." }),
    ]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe(
        'duplicate corpus entry id "solid.srp.violation.god-class".',
      );
    }
  });

  test("names its error so callers can discriminate it", () => {
    expect(new InvalidCorpusError("boom").name).toBe("InvalidCorpusError");
  });

  test("reports the index of the offending entry", () => {
    const result = validateCorpus([entryOf(), entryOf({ id: "b", language: "" })]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toBe("entries[1].language must not be empty.");
    }
  });
});
