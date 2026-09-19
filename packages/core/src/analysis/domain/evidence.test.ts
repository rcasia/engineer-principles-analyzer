import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import { Evidence, InvalidEvidenceError } from "./evidence.ts";
import { SourceLocation } from "./source-location.ts";

const location = unwrap(
  SourceLocation.of({ filePath: "src/a.ts", startLine: 1 }),
);

describe("Evidence", () => {
  it("keeps the location and excerpt it was given", () => {
    const evidence = unwrap(
      Evidence.of({ location, excerpt: "class Foo {}" }),
    );

    expect(evidence.location).toBe(location);
    expect(evidence.excerpt).toBe("class Foo {}");
  });

  it.each(["", "   ", "\n\t"])(
    "rejects %p as an excerpt, as an error value rather than a throw, because blank evidence is not evidence",
    (excerpt) => {
      expect(unwrapErr(Evidence.of({ location, excerpt }))).toEqual(
        new InvalidEvidenceError("excerpt must not be empty."),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(
      unwrapErr(Evidence.of({ location, excerpt: "" })),
    ).toBeInstanceOf(InvalidEvidenceError);
    expect(new InvalidEvidenceError("boom").name).toBe("InvalidEvidenceError");
  });
});
