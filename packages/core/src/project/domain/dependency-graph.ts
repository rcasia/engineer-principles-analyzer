import { err, ok, type Result } from "../../shared/result.ts";

export class InvalidDependencyGraphError extends Error {
  override readonly name = "InvalidDependencyGraphError";
}

export interface DependencyEdge {
  /** Path of the file that depends on `to`. */
  readonly from: string;
  /** Path of the file being depended upon. */
  readonly to: string;
}

export interface DependencyGraphProps {
  /** Every file the graph knows about. Edge endpoints must be members. */
  readonly nodes: readonly string[];
  readonly edges: readonly DependencyEdge[];
}

/**
 * Which files of a project depend on which (#22, #39): the context
 * cross-file conclusions are drawn from.
 *
 * Immutable value object: the only way to obtain one is
 * {@link DependencyGraph.of}. A self-edge is rejected — a file depending on
 * itself is a malformed input, not a dependency — and every endpoint must be
 * a known node, so "the graph covers this file" always has an exact meaning.
 */
export class DependencyGraph {
  private constructor(
    readonly nodes: readonly string[],
    readonly edges: readonly DependencyEdge[],
  ) {}

  static of(
    props: DependencyGraphProps,
  ): Result<DependencyGraph, InvalidDependencyGraphError> {
    if (props.nodes.length === 0) {
      return err(
        new InvalidDependencyGraphError(
          "dependency graph must contain at least one node.",
        ),
      );
    }

    const known = new Set<string>();
    for (const node of props.nodes) {
      if (node.trim().length === 0) {
        return err(
          new InvalidDependencyGraphError("node paths must not be empty."),
        );
      }
      if (known.has(node)) {
        return err(
          new InvalidDependencyGraphError(`duplicate node "${node}".`),
        );
      }
      known.add(node);
    }

    for (const edge of props.edges) {
      if (edge.from === edge.to) {
        return err(
          new InvalidDependencyGraphError(
            `a file cannot depend on itself: "${edge.from}".`,
          ),
        );
      }
      if (!known.has(edge.from)) {
        return err(
          new InvalidDependencyGraphError(
            `unknown node in edge: "${edge.from}".`,
          ),
        );
      }
      if (!known.has(edge.to)) {
        return err(
          new InvalidDependencyGraphError(`unknown node in edge: "${edge.to}".`),
        );
      }
    }

    return ok(
      new DependencyGraph(
        [...props.nodes],
        props.edges.map((edge) => ({ ...edge })),
      ),
    );
  }
}

/**
 * Shortest dependency path from `from` to `to` (BFS, edge order), or
 * `undefined` when `to` is unreachable. Pure: the path is what architecture
 * findings cite as evidence (#39 "findings include dependency-path
 * evidence").
 */
export function dependencyPath(
  graph: DependencyGraph,
  from: string,
  to: string,
): readonly string[] | undefined {
  if (from === to) {
    return [from];
  }

  const visited = new Set<string>([from]);
  const queue: string[][] = [[from]];
  for (let head = 0; head < queue.length; head += 1) {
    // `head` only ever indexes paths already appended above, so this is
    // always defined — the same cast the architecture evaluation uses.
    const path = queue[head] as string[];
    const current = path[path.length - 1];
    for (const edge of graph.edges) {
      if (edge.from !== current || visited.has(edge.to)) {
        continue;
      }
      const next = [...path, edge.to];
      if (edge.to === to) {
        return next;
      }
      visited.add(edge.to);
      queue.push(next);
    }
  }
  return undefined;
}

/**
 * Dependency-graph coverage for a project (#22 "dependency-graph coverage"):
 * the fraction of project files the graph knows about. `0` when there is no
 * project to cover, never `NaN`.
 */
export function graphCoverage(
  graph: DependencyGraph,
  filePaths: readonly string[],
): number {
  if (filePaths.length === 0) {
    return 0;
  }
  const known = new Set(graph.nodes);
  const covered = filePaths.filter((path) => known.has(path)).length;
  return covered / filePaths.length;
}

/**
 * Whether the graph covers enough of the project to draw conclusions from
 * (#39 "not inferred without sufficient graph coverage"). A strict
 * comparison: exactly-at-threshold counts as sufficient.
 */
export function hasSufficientCoverage(
  graph: DependencyGraph,
  filePaths: readonly string[],
  threshold: number,
): boolean {
  return graphCoverage(graph, filePaths) >= threshold;
}
