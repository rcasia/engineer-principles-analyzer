import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  ArchitectureConstraint,
  InvalidArchitectureConstraintError,
  isArchitectureConstraintKind,
  matchesPath,
} from "./architecture-constraint.ts";

describe("ArchitectureConstraint", () => {
  it("constructs with the exact fields it was given", () => {
    const constraint = unwrap(
      ArchitectureConstraint.of({
        id: "no-ui-to-db",
        fromPattern: "ui",
        toPattern: "db",
        kind: "forbidden",
        description: "UI must not reach the database.",
      }),
    );

    expect(constraint.id).toBe("no-ui-to-db");
    expect(constraint.kind).toBe("forbidden");
    expect(constraint.description).toBe("UI must not reach the database.");
  });

  it("rejects an empty id", () => {
    expect(
      unwrapErr(
        ArchitectureConstraint.of({
          id: "  ",
          fromPattern: "ui",
          toPattern: "db",
          kind: "forbidden",
        }),
      ),
    ).toEqual(
      new InvalidArchitectureConstraintError(
        "constraint id must not be empty.",
      ),
    );
  });

  it("rejects empty patterns", () => {
    expect(
      unwrapErr(
        ArchitectureConstraint.of({
          id: "x",
          fromPattern: "",
          toPattern: "db",
          kind: "forbidden",
        }),
      ),
    ).toEqual(
      new InvalidArchitectureConstraintError("fromPattern must not be empty."),
    );
    expect(
      unwrapErr(
        ArchitectureConstraint.of({
          id: "x",
          fromPattern: "   ",
          toPattern: "db",
          kind: "forbidden",
        }),
      ),
    ).toEqual(
      new InvalidArchitectureConstraintError("fromPattern must not be empty."),
    );
    expect(
      unwrapErr(
        ArchitectureConstraint.of({
          id: "x",
          fromPattern: "ui",
          toPattern: "  ",
          kind: "forbidden",
        }),
      ),
    ).toEqual(
      new InvalidArchitectureConstraintError("toPattern must not be empty."),
    );
  });

  it("rejects an unknown kind", () => {
    expect(
      unwrapErr(
        ArchitectureConstraint.of({
          id: "x",
          fromPattern: "ui",
          toPattern: "db",
          kind: "sometimes" as "forbidden",
        }),
      ),
    ).toEqual(
      new InvalidArchitectureConstraintError(
        'kind must be "forbidden" or "allowed", got "sometimes".',
      ),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidArchitectureConstraintError("boom").name).toBe(
      "InvalidArchitectureConstraintError",
    );
  });
});

describe("isArchitectureConstraintKind", () => {
  it("accepts exactly the two known kinds", () => {
    expect(isArchitectureConstraintKind("forbidden")).toBe(true);
    expect(isArchitectureConstraintKind("allowed")).toBe(true);
    expect(isArchitectureConstraintKind("Forbidden")).toBe(false);
    expect(isArchitectureConstraintKind("")).toBe(false);
  });
});

describe("matchesPath", () => {
  it("matches an exact path", () => {
    expect(matchesPath("ui", "ui")).toBe(true);
  });

  it("matches a whole leading segment", () => {
    expect(matchesPath("ui/button.ts", "ui")).toBe(true);
  });

  it("does not match a partial segment", () => {
    expect(matchesPath("ui-kit/x.ts", "ui")).toBe(false);
    expect(matchesPath("other/ui.ts", "ui")).toBe(false);
  });
});
