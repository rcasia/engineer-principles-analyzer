import { describe, expect, test } from "bun:test";
import {
  buildNoulRequestBody,
  JEV_ENDPOINT,
  JEV_MODEL,
  JEV_NOUL_QUESTION_ID,
} from "./jev-request.ts";

describe("Jev request", () => {
  test("exposes the SystemOne endpoint, model alias and question id", () => {
    expect(JEV_ENDPOINT).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JEV_MODEL).toBe("jev-latest");
    expect(JEV_NOUL_QUESTION_ID).toBe("noul");
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
});
