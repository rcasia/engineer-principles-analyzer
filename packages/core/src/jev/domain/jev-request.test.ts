import { describe, expect, test } from "bun:test";
import {
  buildChoiceRequestBody,
  buildNoulRequestBody,
  JEV_CHOICE_QUESTION_ID,
  JEV_ENDPOINT,
  JEV_MODEL,
  JEV_NOUL_QUESTION_ID,
} from "./jev-request.ts";

describe("Jev request", () => {
  test("exposes the SystemOne endpoint, model alias and question ids", () => {
    expect(JEV_ENDPOINT).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JEV_MODEL).toBe("jev-latest");
    expect(JEV_NOUL_QUESTION_ID).toBe("noul");
    expect(JEV_CHOICE_QUESTION_ID).toBe("choice");
  });

  test("builds the exact wire body for a Noul question with criteria", () => {
    expect(
      buildNoulRequestBody(
        { sourceCode: "class Foo {}", language: "typescript" },
        "jev-latest",
        "noul",
        {
          instructions: "Does this violate SRP?",
          criteria: { true: "Several jobs.", false: "One job." },
        },
      ),
    ).toEqual({
      state: { sourceCode: "class Foo {}", language: "typescript" },
      model: "jev-latest",
      questions: {
        noul: {
          type: "noul",
          instructions: "Does this violate SRP?",
          criteria: { true: "Several jobs.", false: "One job." },
        },
      },
    });
  });

  test("omits the criteria key entirely when the question has none", () => {
    const body = buildNoulRequestBody("some state", "jev-latest", "noul", {
      instructions: "Does this violate SRP?",
    });

    const question = body.questions["noul"];
    expect(question).toBeDefined();
    expect(question !== undefined && "criteria" in question).toBe(false);
  });

  test("keys the question under the caller-chosen id", () => {
    const body = buildNoulRequestBody("state", "jev-latest", "custom-id", {
      instructions: "Does this violate SRP?",
    });

    expect(Object.keys(body.questions)).toEqual(["custom-id"]);
  });

  test("builds the exact wire body for a Choice question", () => {
    expect(
      buildChoiceRequestBody(
        { sourceCode: "package main", filename: "" },
        "jev-latest",
        "choice",
        {
          instructions: "What programming language is this?",
          criteria: {
            go: "Go source.",
            python: "Python source.",
            other: null,
          },
        },
      ),
    ).toEqual({
      state: { sourceCode: "package main", filename: "" },
      model: "jev-latest",
      questions: {
        choice: {
          type: "choice",
          instructions: "What programming language is this?",
          criteria: {
            go: "Go source.",
            python: "Python source.",
            other: null,
          },
        },
      },
    });
  });

  test("keys the Choice question under the caller-chosen id", () => {
    const body = buildChoiceRequestBody("state", "jev-latest", "language", {
      instructions: "What programming language is this?",
      criteria: { go: "Go source." },
    });

    expect(Object.keys(body.questions)).toEqual(["language"]);
  });
});
