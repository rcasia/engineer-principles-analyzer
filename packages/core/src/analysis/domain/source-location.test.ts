import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  InvalidSourceLocationError,
  SourceLocation,
} from "./source-location.ts";

describe("SourceLocation", () => {
  it("accepts a single line with no file path or columns", () => {
    const location = unwrap(SourceLocation.of({ startLine: 3 }));

    expect(location.filePath).toBeUndefined();
    expect(location.startLine).toBe(3);
    expect(location.endLine).toBe(3);
    expect(location.startColumn).toBeUndefined();
    expect(location.endColumn).toBeUndefined();
  });

  it("keeps the file path it was given", () => {
    expect(
      unwrap(SourceLocation.of({ filePath: "src/a.ts", startLine: 1 }))
        .filePath,
    ).toBe("src/a.ts");
  });

  it("defaults endLine to startLine when omitted", () => {
    expect(unwrap(SourceLocation.of({ startLine: 7 })).endLine).toBe(7);
  });

  it("keeps an explicit endLine that spans multiple lines", () => {
    expect(
      unwrap(SourceLocation.of({ startLine: 7, endLine: 9 })).endLine,
    ).toBe(9);
  });

  it("keeps explicit start and end columns", () => {
    const location = unwrap(
      SourceLocation.of({
        startLine: 1,
        startColumn: 2,
        endLine: 1,
        endColumn: 5,
      }),
    );

    expect(location.startColumn).toBe(2);
    expect(location.endColumn).toBe(5);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects %p as startLine, as an error value rather than a throw",
    (startLine) => {
      expect(unwrapErr(SourceLocation.of({ startLine }))).toEqual(
        new InvalidSourceLocationError(
          "startLine must be a positive integer.",
        ),
      );
    },
  );

  it.each([0, -1, 1.5])(
    "rejects %p as endLine, as an error value rather than a throw",
    (endLine) => {
      expect(
        unwrapErr(SourceLocation.of({ startLine: 1, endLine })),
      ).toEqual(
        new InvalidSourceLocationError("endLine must be a positive integer."),
      );
    },
  );

  it("rejects an endLine before startLine, as an error value rather than a throw", () => {
    expect(
      unwrapErr(SourceLocation.of({ startLine: 5, endLine: 4 })),
    ).toEqual(
      new InvalidSourceLocationError("endLine must not be before startLine."),
    );
  });

  it.each([0, -1, 1.5])(
    "rejects %p as startColumn, as an error value rather than a throw",
    (startColumn) => {
      expect(
        unwrapErr(SourceLocation.of({ startLine: 1, startColumn })),
      ).toEqual(
        new InvalidSourceLocationError(
          "startColumn must be a positive integer.",
        ),
      );
    },
  );

  it.each([0, -1, 1.5])(
    "rejects %p as endColumn, as an error value rather than a throw",
    (endColumn) => {
      expect(
        unwrapErr(SourceLocation.of({ startLine: 1, endColumn })),
      ).toEqual(
        new InvalidSourceLocationError(
          "endColumn must be a positive integer.",
        ),
      );
    },
  );

  it("rejects an endColumn before startColumn on the same line, as an error value rather than a throw", () => {
    expect(
      unwrapErr(
        SourceLocation.of({
          startLine: 1,
          startColumn: 5,
          endLine: 1,
          endColumn: 4,
        }),
      ),
    ).toEqual(
      new InvalidSourceLocationError(
        "endColumn must not be before startColumn on the same line.",
      ),
    );
  });

  it("allows a defined endColumn when startColumn is undefined", () => {
    const location = unwrap(
      SourceLocation.of({ startLine: 1, endColumn: 5 }),
    );

    expect(location.startColumn).toBeUndefined();
    expect(location.endColumn).toBe(5);
  });

  it("allows a defined startColumn when endColumn is undefined", () => {
    const location = unwrap(
      SourceLocation.of({ startLine: 1, startColumn: 5 }),
    );

    expect(location.startColumn).toBe(5);
    expect(location.endColumn).toBeUndefined();
  });

  it("allows an endColumn equal to startColumn on the same line", () => {
    const location = unwrap(
      SourceLocation.of({
        startLine: 1,
        startColumn: 5,
        endLine: 1,
        endColumn: 5,
      }),
    );

    expect(location.startColumn).toBe(5);
    expect(location.endColumn).toBe(5);
  });

  it("allows an endColumn before startColumn across different lines", () => {
    const location = unwrap(
      SourceLocation.of({
        startLine: 1,
        startColumn: 10,
        endLine: 2,
        endColumn: 1,
      }),
    );

    expect(location.startColumn).toBe(10);
    expect(location.endColumn).toBe(1);
  });

  it("names its error so callers can discriminate it", () => {
    expect(unwrapErr(SourceLocation.of({ startLine: 0 }))).toBeInstanceOf(
      InvalidSourceLocationError,
    );
    expect(new InvalidSourceLocationError("boom").name).toBe(
      "InvalidSourceLocationError",
    );
  });

  it("is equal to another location with the same fields", () => {
    const props = {
      filePath: "src/a.ts",
      startLine: 1,
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    };

    expect(
      unwrap(SourceLocation.of(props)).equals(
        unwrap(SourceLocation.of(props)),
      ),
    ).toBe(true);
  });

  it.each([
    { filePath: "src/b.ts" },
    { startLine: 2 },
    { startColumn: 3 },
    { endLine: 5 },
    { endColumn: 9 },
  ])("is not equal when %p differs", (override) => {
    const props = {
      filePath: "src/a.ts",
      startLine: 1,
      startColumn: 2,
      endLine: 3,
      endColumn: 4,
    };

    expect(
      unwrap(SourceLocation.of(props)).equals(
        unwrap(SourceLocation.of({ ...props, ...override })),
      ),
    ).toBe(false);
  });
});
