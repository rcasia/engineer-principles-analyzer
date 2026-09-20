import { describe, expect, test } from "bun:test";
import { unwrapErr } from "../../shared/result.ts";
import {
  parseChoiceAnswerBody,
  parseNoulAnswerBody,
} from "./jev-response.ts";

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

const CHOICE_OPTIONS = ["go", "python", "other"];

function validChoiceBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    model: "jev-1.13.0",
    answers: {
      choice: {
        type: "choice",
        choice: "go",
        probabilities: { go: 0.85, python: 0.1, other: 0.05 },
        confidence: 0.82,
      },
    },
    usage: { input_tokens: 312, output_tokens: 48 },
    ...overrides,
  };
}

describe("parseChoiceAnswerBody", () => {
  test("parses a valid body and ignores extra fields", () => {
    const parsed = parseChoiceAnswerBody(
      validChoiceBody(),
      "choice",
      CHOICE_OPTIONS,
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        choice: "go",
        probabilities: { go: 0.85, python: 0.1, other: 0.05 },
        confidence: 0.82,
        model: "jev-1.13.0",
      });
    }
  });

  test("accepts the boundary probabilities 0 and 1", () => {
    const parsed = parseChoiceAnswerBody(
      validChoiceBody({
        answers: {
          choice: {
            type: "choice",
            choice: "other",
            probabilities: { go: 0, python: 0, other: 1 },
            confidence: 1,
          },
        },
      }),
      "choice",
      CHOICE_OPTIONS,
    );

    expect(parsed.ok).toBe(true);
  });

  test("rejects a null body", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody(null, "choice", CHOICE_OPTIONS)).message,
    ).toBe("Jev response body must be an object.");
  });

  test("rejects a string body", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody("ok", "choice", CHOICE_OPTIONS)).message,
    ).toBe("Jev response body must be an object.");
  });

  test("rejects an array body", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody([], "choice", CHOICE_OPTIONS)).message,
    ).toBe("Jev response body must be an object.");
  });

  test("rejects a missing model", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody({ answers: {} }, "choice", CHOICE_OPTIONS),
      ).message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects an array body", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody([], "choice", CHOICE_OPTIONS)).message,
    ).toBe("Jev response body must be an object.");
  });

  test("rejects a blank model", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ model: "  " }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects a non-string model", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ model: 7 }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe("Jev response model must be a non-empty string.");
  });

  test("rejects missing answers", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          { model: "jev-1.13.0" },
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects null answers", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ answers: null }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects an answers array", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ answers: [] }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe("Jev response answers must be an object.");
  });

  test("rejects a missing answer for the question id", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody(validChoiceBody(), "other", CHOICE_OPTIONS))
        .message,
    ).toBe('Jev response has no answer for question "other".');
  });

  test("rejects a null answer for the question id", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ answers: { choice: null } }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe('Jev response has no answer for question "choice".');
  });

  test("rejects an answer array for the question id", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({ answers: { choice: [] } }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe('Jev response has no answer for question "choice".');
  });

  test("rejects an answer of the wrong type", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: { choice: { type: "noul", noul: 0.9 } },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe('Jev answer for question "choice" must be a choice answer.');
  });

  test("rejects a missing answer type", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                choice: "go",
                probabilities: { go: 1, python: 0, other: 0 },
                confidence: 1,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe('Jev answer for question "choice" must be a choice answer.');
  });

  test("rejects a choice outside the expected options", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "cobol",
                probabilities: { go: 0, python: 0, other: 1 },
                confidence: 1,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer choice for question "choice" must be one of: go, python, other.',
    );
  });

  test("rejects a non-string choice", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: 7,
                probabilities: { go: 1, python: 0, other: 0 },
                confidence: 1,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer choice for question "choice" must be one of: go, python, other.',
    );
  });

  test("rejects non-object probabilities", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: [0.85],
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must be an object.',
    );
  });

  test("rejects null probabilities", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: null,
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must be an object.',
    );
  });

  test("rejects string probabilities", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: "go: 0.85",
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must be an object.',
    );
  });

  test("rejects probabilities missing an expected option", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 1 },
                confidence: 1,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must map every option to a number between 0 and 1.',
    );
  });

  test("rejects a probability above 1", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 1.1, python: 0, other: 0 },
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must map every option to a number between 0 and 1.',
    );
  });

  test("rejects an out-of-range probability", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 0.9, python: 0.1, other: -0.1 },
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must map every option to a number between 0 and 1.',
    );
  });

  test("rejects a non-number probability", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: "0.85", python: 0.1, other: 0.05 },
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must map every option to a number between 0 and 1.',
    );
  });

  test("rejects NaN probabilities", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: Number.NaN, python: 0.5, other: 0.5 },
                confidence: 0.82,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer probabilities for question "choice" must map every option to a number between 0 and 1.',
    );
  });

  test("rejects a missing confidence", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 1, python: 0, other: 0 },
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer confidence for question "choice" must be a number between 0 and 1.',
    );
  });

  test("rejects an out-of-range confidence", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 1, python: 0, other: 0 },
                confidence: 1.5,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer confidence for question "choice" must be a number between 0 and 1.',
    );
  });

  test("rejects a negative confidence", () => {
    expect(
      unwrapErr(
        parseChoiceAnswerBody(
          validChoiceBody({
            answers: {
              choice: {
                type: "choice",
                choice: "go",
                probabilities: { go: 1, python: 0, other: 0 },
                confidence: -0.5,
              },
            },
          }),
          "choice",
          CHOICE_OPTIONS,
        ),
      ).message,
    ).toBe(
      'Jev answer confidence for question "choice" must be a number between 0 and 1.',
    );
  });

  test("accepts the boundary confidence 0", () => {
    const parsed = parseChoiceAnswerBody(
      validChoiceBody({
        answers: {
          choice: {
            type: "choice",
            choice: "go",
            probabilities: { go: 1, python: 0, other: 0 },
            confidence: 0,
          },
        },
      }),
      "choice",
      CHOICE_OPTIONS,
    );

    expect(parsed.ok).toBe(true);
  });

  test("names its error InvalidJevResponseError", () => {
    expect(
      unwrapErr(parseChoiceAnswerBody(null, "choice", CHOICE_OPTIONS)).name,
    ).toBe("InvalidJevResponseError");
  });
});
