import { describe, expect, it } from "bun:test";
import { unwrap } from "../../shared/result.ts";
import { ArchitectureConstraint } from "../domain/architecture-constraint.ts";
import {
  EvaluateArchitecture,
  InvalidArchitectureEvaluationError,
} from "./evaluate-architecture.use-case.ts";

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

describe("EvaluateArchitecture", () => {
  it("reports a violation with dependency-path evidence", () => {
    const evaluation = new EvaluateArchitecture().execute({
      nodes: ["ui/a.ts", "db/b.ts"],
      edges: [{ from: "ui/a.ts", to: "db/b.ts" }],
      constraints: [forbidden()],
      language: "project",
    });

    expect(evaluation.graphCoverage).toBe(1);
    expect(evaluation.violations).toEqual([
      {
        constraintId: "no-ui-to-db",
        from: "ui/a.ts",
        to: "db/b.ts",
        path: ["ui/a.ts", "db/b.ts"],
      },
    ]);
    expect(evaluation.results).toHaveLength(1);
    const result = evaluation.results[0];
    expect(result?.ruleId).toBe("architecture.no-ui-to-db");
    expect(result?.status).toBe("violation");
    expect(result?.method).toBe("deterministic");
    expect(result?.confidence.value).toBe(1);
    expect(result?.explanation).toBe(
      '1 dependency path(s) violate constraint "no-ui-to-db".',
    );
    expect(
      evaluation.results[0]?.evidence.map((evidence) => evidence.excerpt),
    ).toEqual(["dependency path: ui/a.ts -> db/b.ts"]);
    expect(
      evaluation.results[0]?.evidence.map(
        (evidence) => evidence.location.filePath,
      ),
    ).toEqual(["ui/a.ts"]);
    expect(result?.humanReviewRecommended).toBe(false);
  });

  it("concludes compliant only at full graph coverage", () => {
    const evaluation = new EvaluateArchitecture().execute({
      nodes: ["ui/a.ts", "service/b.ts"],
      edges: [{ from: "ui/a.ts", to: "service/b.ts" }],
      constraints: [forbidden()],
      language: "project",
    });

    expect(evaluation.results[0]?.status).toBe("compliant");
    expect(evaluation.results[0]?.explanation).toBe(
      'No dependency violates constraint "no-ui-to-db" at graph coverage 1.',
    );
  });

  it("reports uncertain when coverage is insufficient to conclude compliance", () => {
    const evaluation = new EvaluateArchitecture().execute({
      nodes: ["ui/a.ts", "service/b.ts", "unseen/c.ts"],
      edges: [{ from: "ui/a.ts", to: "service/b.ts" }],
      constraints: [forbidden()],
      language: "project",
    });

    expect(evaluation.graphCoverage).toBe(2 / 3);
    expect(evaluation.results[0]?.status).toBe("uncertain");
    expect(evaluation.results[0]?.humanReviewRecommended).toBe(true);
    expect(evaluation.results[0]?.explanation).toBe(
      'Cannot decide constraint "no-ui-to-db": graph coverage 0.6666666666666666 is below the required 1.',
    );
    expect(evaluation.results[0]?.limitations).toEqual([
      "Graph coverage is 0.6666666666666666, below the required 1; unobserved edges may hide violations.",
      "Re-run with fuller graph coverage before treating this constraint as satisfied.",
    ]);
  });

  it("still reports found violations under partial coverage, with the coverage noted", () => {
    const evaluation = new EvaluateArchitecture().execute({
      nodes: ["ui/a.ts", "db/b.ts", "unseen/c.ts"],
      edges: [{ from: "ui/a.ts", to: "db/b.ts" }],
      constraints: [forbidden()],
      language: "project",
    });

    expect(evaluation.results[0]?.status).toBe("violation");
    expect(evaluation.results[0]?.limitations).toEqual([
      "Graph coverage is 0.6666666666666666: conclusions cover only observed edges.",
    ]);
  });

  it("accepts a lower required coverage explicitly", () => {
    const evaluation = new EvaluateArchitecture().execute({
      nodes: ["ui/a.ts", "service/b.ts", "unseen/c.ts"],
      edges: [{ from: "ui/a.ts", to: "service/b.ts" }],
      constraints: [forbidden()],
      language: "project",
      minimumCoverage: 0.5,
    });

    expect(evaluation.results[0]?.status).toBe("compliant");
  });

  it.each([0, -0.5, 1.5, Number.NaN])(
    "rejects %p as minimumCoverage",
    (minimumCoverage) => {
      expect(() =>
        new EvaluateArchitecture().execute({
          nodes: ["ui/a.ts"],
          edges: [],
          constraints: [forbidden()],
          language: "project",
          minimumCoverage,
        }),
      ).toThrow(
        new InvalidArchitectureEvaluationError(
          "minimumCoverage must be a number in (0, 1].",
        ),
      );
    },
  );

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidArchitectureEvaluationError("boom").name).toBe(
      "InvalidArchitectureEvaluationError",
    );
  });
});
