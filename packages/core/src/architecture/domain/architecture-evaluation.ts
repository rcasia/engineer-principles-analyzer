import {
  type ArchitectureConstraint,
  matchesPath,
} from "./architecture-constraint.ts";

/** One dependency edge the architecture evaluation can observe. Structurally compatible with the project slice's `DependencyEdge`. */
export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
}

/**
 * One violated constraint with the dependency path that proves it (#39
 * "findings include dependency-path evidence"). For `"forbidden"`
 * constraints the path can span several hops; for `"allowed"` constraints
 * it is always the single offending edge.
 */
export interface ArchitectureViolation {
  readonly constraintId: string;
  readonly from: string;
  readonly to: string;
  readonly path: readonly string[];
}

/**
 * Checks every constraint against the observed edges (#23, #39). Pure:
 * no I/O, no rule catalog, just edges and constraints in, violations out.
 *
 * `"forbidden"` constraints are checked transitively — `ui` reaching `db`
 * through an intermediate module is still a violation, and the full path is
 * reported — while `"allowed"` constraints check each edge directly: an
 * edge out of `fromPattern` to anywhere outside `toPattern` violates.
 */
export function evaluateArchitecture(
  edges: readonly ArchitectureEdge[],
  constraints: readonly ArchitectureConstraint[],
): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const constraint of constraints) {
    if (constraint.kind === "forbidden") {
      violations.push(...forbiddenViolations(edges, constraint));
    } else {
      violations.push(...allowlistViolations(edges, constraint));
    }
  }
  return violations;
}

function forbiddenViolations(
  edges: readonly ArchitectureEdge[],
  constraint: ArchitectureConstraint,
): readonly ArchitectureViolation[] {
  const sources: string[] = [];
  for (const edge of edges) {
    if (matchesPath(edge.from, constraint.fromPattern) && !sources.includes(edge.from)) {
      sources.push(edge.from);
    }
  }

  const violations: ArchitectureViolation[] = [];
  for (const source of sources) {
    const path = nearestTarget(edges, source, constraint.toPattern);
    if (path !== undefined) {
      violations.push({
        constraintId: constraint.id,
        from: source,
        to: path[path.length - 1] as string,
        path,
      });
    }
  }
  return violations;
}

function allowlistViolations(
  edges: readonly ArchitectureEdge[],
  constraint: ArchitectureConstraint,
): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  for (const edge of edges) {
    if (
      matchesPath(edge.from, constraint.fromPattern) &&
      !matchesPath(edge.to, constraint.toPattern)
    ) {
      violations.push({
        constraintId: constraint.id,
        from: edge.from,
        to: edge.to,
        path: [edge.from, edge.to],
      });
    }
  }
  return violations;
}

/** Shortest path (BFS, edge order) from `source` to any node matching `toPattern`, or `undefined`. Never the trivial self-path. */
function nearestTarget(
  edges: readonly ArchitectureEdge[],
  source: string,
  toPattern: string,
): readonly string[] | undefined {
  const visited = new Set<string>([source]);
  const queue: string[][] = [[source]];
  for (let head = 0; head < queue.length; head += 1) {
    const path = queue[head] as string[];
    const current = path[path.length - 1] as string;
    for (const edge of edges) {
      if (edge.from !== current || visited.has(edge.to)) {
        continue;
      }
      const next = [...path, edge.to];
      if (matchesPath(edge.to, toPattern)) {
        return next;
      }
      visited.add(edge.to);
      queue.push(next);
    }
  }
  return undefined;
}

/**
 * Graph/dependency coverage for architecture conclusions (#23 "graph/
 * dependency coverage"): the fraction of known nodes incident to at least
 * one observed edge. `0` when there is nothing to cover, never `NaN`.
 */
export function architectureGraphCoverage(
  nodes: readonly string[],
  edges: readonly ArchitectureEdge[],
): number {
  if (nodes.length === 0) {
    return 0;
  }
  const incident = new Set<string>();
  for (const edge of edges) {
    incident.add(edge.from);
    incident.add(edge.to);
  }
  return nodes.filter((node) => incident.has(node)).length / nodes.length;
}
