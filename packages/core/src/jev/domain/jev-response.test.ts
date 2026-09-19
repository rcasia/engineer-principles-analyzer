import { describe, expect, test } from "bun:test";
import { unwrapErr } from "../../shared/result.ts";
import { parseNoulAnswerBody } from "./jev-response.ts";

function validBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    model: "jev-1.13.0",
    answers: {
      noul: { type: "noul", noul: 0.92 },
    },
    usage: { input_tokens: 312, output_tokens: 48 },
    ...overrides,
  };
}

describe("parseNoulAnswerBody", () => {
  test("parses a valid body and ignores extra fields", () => {
    const parsed = parseNoulAnswerBody(validBody(), "noul");

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({ value: 0.92, model: "jev-1.13.0" });
    }
  });

  test("accepts the boundary values 0 and 1", () => {
    for (const boundary of [0, 1]) {
      const parsed = parseNoulAnswerBody(
        validBody({
          answers: { noul: { type: "noul", noul: boundary } },
        }),
        "noul",
      );

      expect(parsed.ok).toBe(true);
    }
  });

  test("rejects a null body", () => {
    expect(unwrapErr(parseNoulAnswerBody(null, "noul")).message).toBe(
      "Jev response body must be an object.",
    );
  });

  test("rejects an array body", () => {
    expect(unwrapErr(parseNoulAnswerBody([], "noul")).message).toBe(
      "Jev response body must be an object.",
    );
  });

  test("rejects a string body", () => {
    expect(unwrapErr(parseNoulAnswerBody("ok", "noul")).message).toBe(
      "Jev response body must be an object.",
    );
  });

  test("rejects a missing model", () => {
    expect(
      unwrapErr(parseNoulAnswerBody({ answers: {} }, "noul")).message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects a blank model", () => {
    expect(
      unwrapErr(parseNoulAnswerBody(validBody({ model: "  " }), "noul"))
        .message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects a non-string model", () => {
    expect(
      unwrapErr(parseNoulAnswerBody(validBody({ model: 7 }), "noul")).message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects missing answers", () => {
    expect(
      unwrapErr(parseNoulAnswerBody({ model: "jev-1.13.0" }, "noul")).message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects null answers", () => {
    expect(
      unwrapErr(parseNoulAnswerBody(validBody({ answers: null }), "noul"))
        .message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects an answers array", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: [] }),
          "noul",
        ),
      ).message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects a missing answer for the question id", () => {
    expect(unwrapErr(parseNoulAnswerBody(validBody(), "other")).message).toBe(
      'Jev response has no answer for question "other".',
    );
  });

  test("rejects a null answer for the question id", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(validBody({ answers: { noul: null } }), "noul"),
      ).message,
    ).toBe('Jev response has no answer for question "noul".');
  });

  test("rejects an answer of the wrong type", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({
            answers: { noul: { type: "choice", choice: "x" } },
          }),
          "noul",
        ),
      ).message,
    ).toBe('Jev answer for question "noul" must be a noul answer.');
  });

  test("rejects a missing answer type", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: { noul: { noul: 0.5 } } }),
          "noul",
        ),
      ).message,
    ).toBe('Jev answer for question "noul" must be a noul answer.');
  });

  test("rejects a string noul", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: { noul: { type: "noul", noul: "0.9" } } }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("rejects a missing noul", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: { noul: { type: "noul" } } }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("rejects NaN", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({
            answers: { noul: { type: "noul", noul: Number.NaN } },
          }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("rejects Infinity", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({
            answers: { noul: { type: "noul", noul: Number.POSITIVE_INFINITY } },
          }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("rejects a noul below 0", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: { noul: { type: "noul", noul: -0.1 } } }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("rejects a noul above 1", () => {
    expect(
      unwrapErr(
        parseNoulAnswerBody(
          validBody({ answers: { noul: { type: "noul", noul: 1.1 } } }),
          "noul",
        ),
      ).message,
    ).toBe(
      'Jev answer noul for question "noul" must be a number between 0 and 1.',
    );
  });

  test("names its error InvalidJevResponseError", () => {
    expect(unwrapErr(parseNoulAnswerBody(null, "noul")).name).toBe(
      "InvalidJevResponseError",
    );
  });
});
