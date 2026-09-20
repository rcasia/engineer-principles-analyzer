import type { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { DependencyGraph } from "../domain/dependency-graph.ts";
import type { Project } from "../domain/project.ts";

/**
 * Driven port: one independently executable unit of judgment against a whole
 * {@link Project} with its {@link DependencyGraph} (#22, #38).
 *
 * The project-level counterpart of the engine's `Rule` port: single-file
 * rules cannot see relationships between files, so anything that reasons
 * about cross-file evidence or dependency conclusions implements this port
 * instead. Like `Rule.evaluate`, implementations may reject or throw — the
 * project use-case isolates that failure per rule.
 */
export interface ProjectRule {
  /** Stable identifier, e.g. `"architecture.dependency"`. */
  readonly id: string;
  evaluate(project: Project, graph: DependencyGraph): Promise<AnalysisResult>;
}
