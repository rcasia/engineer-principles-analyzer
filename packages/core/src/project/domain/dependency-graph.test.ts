import { describe, expect, it } from "bun:test";
import { unwrap, unwrapErr } from "../../shared/result.ts";
import {
  dependencyPath,
  DependencyGraph,
  graphCoverage,
  hasSufficientCoverage,
  InvalidDependencyGraphError,
} from "./dependency-graph.ts";

function graph(): DependencyGraph {
  return unwrap(
    DependencyGraph.of({
      nodes: ["a.ts", "b.ts", "c.ts"],
      edges: [
        { from: "a.ts", to: "b.ts" },
        { from: "b.ts", to: "c.ts" },
      ],
    }),
  );
}

describe("DependencyGraph", () => {
  it("constructs with the exact nodes and edges it was given", () => {
    const graphValue = graph();

    expect(graphValue.nodes).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(graphValue.edges).toEqual([
      { from: "a.ts", to: "b.ts" },
      { from: "b.ts", to: "c.ts" },
    ]);
  });

  it("rejects an empty node list", () => {
    expect(unwrapErr(DependencyGraph.of({ nodes: [], edges: [] }))).toEqual(
      new InvalidDependencyGraphError(
        "dependency graph must contain at least one node.",
      ),
    );
  });

  it("rejects empty and duplicate nodes", () => {
    expect(
      unwrapErr(DependencyGraph.of({ nodes: [""], edges: [] })),
    ).toEqual(
      new InvalidDependencyGraphError("node paths must not be empty."),
    );
    expect(
      unwrapErr(DependencyGraph.of({ nodes: ["a.ts", "a.ts"], edges: [] })),
    ).toEqual(new InvalidDependencyGraphError('duplicate node "a.ts".'));
  });

  it("rejects a self-edge", () => {
    expect(
      unwrapErr(
        DependencyGraph.of({
          nodes: ["a.ts"],
          edges: [{ from: "a.ts", to: "a.ts" }],
        }),
      ),
    ).toEqual(
      new InvalidDependencyGraphError('a file cannot depend on itself: "a.ts".'),
    );
  });

  it("rejects edges to unknown nodes", () => {
    expect(
      unwrapErr(
        DependencyGraph.of({
          nodes: ["a.ts"],
          edges: [{ from: "a.ts", to: "b.ts" }],
        }),
      ),
    ).toEqual(
      new InvalidDependencyGraphError('unknown node in edge: "b.ts".'),
    );
    expect(
      unwrapErr(
        DependencyGraph.of({
          nodes: ["b.ts"],
          edges: [{ from: "a.ts", to: "b.ts" }],
        }),
      ),
    ).toEqual(
      new InvalidDependencyGraphError('unknown node in edge: "a.ts".'),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidDependencyGraphError("boom").name).toBe(
      "InvalidDependencyGraphError",
    );
  });
});

describe("dependencyPath", () => {
  it("returns a direct edge as a two-element path", () => {
    expect(dependencyPath(graph(), "a.ts", "b.ts")).toEqual(["a.ts", "b.ts"]);
  });

  it("returns the shortest transitive path", () => {
    expect(dependencyPath(graph(), "a.ts", "c.ts")).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
    ]);
  });

  it("returns undefined when the target is unreachable", () => {
    expect(dependencyPath(graph(), "c.ts", "a.ts")).toBeUndefined();
  });

  it("returns a single-element path from a node to itself", () => {
    expect(dependencyPath(graph(), "a.ts", "a.ts")).toEqual(["a.ts"]);
  });

  it("does not loop forever on a cycle", () => {
    const cyclic = unwrap(
      DependencyGraph.of({
        nodes: ["a.ts", "b.ts"],
        edges: [
          { from: "a.ts", to: "b.ts" },
          { from: "b.ts", to: "a.ts" },
        ],
      }),
    );

    expect(dependencyPath(cyclic, "a.ts", "b.ts")).toEqual(["a.ts", "b.ts"]);
    expect(dependencyPath(cyclic, "b.ts", "b.ts")).toEqual(["b.ts"]);
  });
});

describe("graphCoverage", () => {
  it("returns 1 when every project file is a known node", () => {
    expect(graphCoverage(graph(), ["a.ts", "b.ts", "c.ts"])).toBe(1);
  });

  it("returns the exact covered fraction", () => {
    expect(graphCoverage(graph(), ["a.ts", "b.ts", "c.ts", "d.ts"])).toBe(0.75);
  });

  it("returns 0 for an empty project instead of NaN", () => {
    expect(graphCoverage(graph(), [])).toBe(0);
  });
});

describe("hasSufficientCoverage", () => {
  it("treats exactly-at-threshold as sufficient", () => {
    expect(hasSufficientCoverage(graph(), ["a.ts", "b.ts", "c.ts", "d.ts"], 0.75)).toBe(
      true,
    );
    expect(hasSufficientCoverage(graph(), ["a.ts", "b.ts", "c.ts", "d.ts"], 0.76)).toBe(
      false,
    );
  });
});
