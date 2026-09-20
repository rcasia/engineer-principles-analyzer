import { describe, expect, it } from "bun:test";
import { unwrap } from "../../shared/result.ts";
import { ArchitectureConstraint } from "./architecture-constraint.ts";
import {
  architectureGraphCoverage,
  evaluateArchitecture,
} from "./architecture-evaluation.ts";

function forbidden(): ArchitectureConstraint {
  return unwrap(
    ArchitectureConstraint.of({
      id: "no-ui-to-db",
      fromPattern: "ui",
      toPattern: "db",
      kind: "forbidden",
    }),
  );
}

function allowlist(): ArchitectureConstraint {
  return unwrap(
    ArchitectureConstraint.of({
      id: "ui-only-uses-components",
      fromPattern: "ui",
      toPattern: "components",
      kind: "allowed",
    }),
  );
}

describe("evaluateArchitecture", () => {
  it("reports a direct forbidden edge with its two-element path", () => {
    expect(
      evaluateArchitecture([{ from: "ui/a.ts", to: "db/b.ts" }], [forbidden()]),
    ).toEqual([
      {
        constraintId: "no-ui-to-db",
        from: "ui/a.ts",
        to: "db/b.ts",
        path: ["ui/a.ts", "db/b.ts"],
      },
    ]);
  });

  it("reports a transitive forbidden path, not just direct edges", () => {
    expect(
      evaluateArchitecture(
        [
          { from: "ui/a.ts", to: "service/b.ts" },
          { from: "service/b.ts", to: "db/c.ts" },
        ],
        [forbidden()],
      ),
    ).toEqual([
      {
        constraintId: "no-ui-to-db",
        from: "ui/a.ts",
        to: "db/c.ts",
        path: ["ui/a.ts", "service/b.ts", "db/c.ts"],
      },
    ]);
  });

  it("reports nothing when the forbidden target is unreachable", () => {
    expect(
      evaluateArchitecture(
        [
          { from: "ui/a.ts", to: "service/b.ts" },
          { from: "other/c.ts", to: "db/d.ts" },
        ],
        [forbidden()],
      ),
    ).toEqual([]);
  });

  it("does not loop forever on a cyclic graph", () => {
    expect(
      evaluateArchitecture(
        [
          { from: "ui/a.ts", to: "service/b.ts" },
          { from: "service/b.ts", to: "ui/a.ts" },
        ],
        [forbidden()],
      ),
    ).toEqual([]);
  });

  it("reports allowlist edges that leave the permitted target", () => {
    expect(
      evaluateArchitecture(
        [
          { from: "ui/a.ts", to: "components/b.ts" },
          { from: "ui/a.ts", to: "db/c.ts" },
        ],
        [allowlist()],
      ),
    ).toEqual([
      {
        constraintId: "ui-only-uses-components",
        from: "ui/a.ts",
        to: "db/c.ts",
        path: ["ui/a.ts", "db/c.ts"],
      },
    ]);
  });

  it("keeps each constraint's violations independent", () => {
    expect(
      evaluateArchitecture([{ from: "ui/a.ts", to: "db/b.ts" }], [
        forbidden(),
        allowlist(),
      ]),
    ).toEqual([
      {
        constraintId: "no-ui-to-db",
        from: "ui/a.ts",
        to: "db/b.ts",
        path: ["ui/a.ts", "db/b.ts"],
      },
      {
        constraintId: "ui-only-uses-components",
        from: "ui/a.ts",
        to: "db/b.ts",
        path: ["ui/a.ts", "db/b.ts"],
      },
    ]);
  });

  it("reports nothing for no constraints", () => {
    expect(
      evaluateArchitecture([{ from: "ui/a.ts", to: "db/b.ts" }], []),
    ).toEqual([]);
  });
});

describe("architectureGraphCoverage", () => {
  it("returns 1 when every node touches an edge", () => {
    expect(
      architectureGraphCoverage(
        ["ui/a.ts", "db/b.ts"],
        [{ from: "ui/a.ts", to: "db/b.ts" }],
      ),
    ).toBe(1);
  });

  it("returns the exact covered fraction", () => {
    expect(
      architectureGraphCoverage(
        ["ui/a.ts", "db/b.ts", "other/c.ts", "docs/d.ts"],
        [{ from: "ui/a.ts", to: "db/b.ts" }],
      ),
    ).toBe(0.5);
  });

  it("returns 0 for an empty node list instead of NaN", () => {
    expect(architectureGraphCoverage([], [])).toBe(0);
  });
});
