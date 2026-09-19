import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { InvalidSubjectError, Subject } from "./subject.ts";

describe("Subject", () => {
  it("constructs with the exact fields it was given", () => {
    const subject = unwrap(
      Subject.of({ sourceCode: "class Foo {}", language: "typescript" }),
    );

    expect(subject.sourceCode).toBe("class Foo {}");
    expect(subject.language).toBe("typescript");
  });

  it.each(["", "   "])(
    "rejects %p as sourceCode, as an error value rather than a throw",
    (sourceCode) => {
      expect(
        unwrapErr(Subject.of({ sourceCode, language: "typescript" })),
      ).toEqual(
        new InvalidSubjectError("sourceCode must not be empty."),
      );
    },
  );

  it.each(["", "   "])(
    "rejects %p as language, as an error value rather than a throw",
    (language) => {
      expect(
        unwrapErr(Subject.of({ sourceCode: "class Foo {}", language })),
      ).toEqual(new InvalidSubjectError("language must not be empty."));
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(
      unwrapErr(Subject.of({ sourceCode: "", language: "typescript" })),
    ).toBeInstanceOf(InvalidSubjectError);
    expect(new InvalidSubjectError("boom").name).toBe("InvalidSubjectError");
  });
});
