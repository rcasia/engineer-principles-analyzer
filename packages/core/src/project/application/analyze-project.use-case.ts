import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { AnalyzerMetadata } from "../../analysis/domain/analyzer-metadata.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import type { IdGenerator } from "../../engine/application/analyze-subject.use-case.ts";
import type { NewEvent } from "../../eventsourcing/application/event-store.port.ts";
import { unwrap } from "../../shared/result.ts";
import {
  type DependencyGraph,
  graphCoverage,
} from "../domain/dependency-graph.ts";
import {
  PROJECT_ANALYSIS_COMPLETED_EVENT,
  PROJECT_ANALYSIS_FAILED_EVENT,
  PROJECT_ANALYSIS_REQUESTED_EVENT,
  type ProjectEventPayload,
} from "../domain/project-event.ts";
import { ProjectMetrics } from "../domain/project-metrics.ts";
import type { Project } from "../domain/project.ts";
import type { ProjectArtifactStore } from "./project-artifact-store.port.ts";
import type { ProjectRule } from "./project-rule.port.ts";
import type { ProjectRuleCatalog } from "./project-rule-catalog.port.ts";

export class InvalidProjectAnalysisError extends Error {
  override readonly name = "InvalidProjectAnalysisError";
}

/** Identifies results the project use-case synthesized itself, not any rule's own verdict. */
const PROJECT_ENGINE_ANALYZER: AnalyzerMetadata = {
  name: "principled-project-engine",
  version: "1",
};

const randomId: IdGenerator = () => crypto.randomUUID();

export interface ProjectAnalysisRequest {
  readonly project: Project;
  readonly graph: DependencyGraph;
  /** Tenant the run belongs to. Required: artifacts are tenant-scoped before anything is persisted (#38). */
  readonly tenantId: string;
  /** Restrict the run to these rule ids. Omitted: every rule in the catalog runs. */
  readonly ruleIds?: readonly string[];
  /**
   * When `true`, file references (never source) are stored in
   * `artifactStore` under `tenantId`. Requires `artifactStore`; the
   * use-case persists nothing by default.
   */
  readonly retainArtifacts?: boolean;
  readonly artifactStore?: ProjectArtifactStore;
}

export interface ProjectAnalysis {
  /** Suggested event-store stream id, if a caller chooses to append `events`. */
  readonly analysisId: string;
  /** One result per requested rule, in request order, whatever that rule did. */
  readonly results: readonly AnalysisResult[];
  /** Facts about the run, shaped for the event-sourcing ports. Never appended by this use-case — persistence stays explicit. */
  readonly events: readonly NewEvent<ProjectEventPayload>[];
  readonly metrics: ProjectMetrics;
}

interface ProjectRuleOutcome {
  readonly result: AnalysisResult;
  readonly event: NewEvent<ProjectEventPayload>;
}

/**
 * Project-level analysis (#22, #38): runs independently-authored project
 * rules against one {@link Project} with its {@link DependencyGraph}.
 *
 * Per-file rules keep running through the engine's `AnalyzeSubject`; this
 * use-case runs only `ProjectRule`s — the rules that need relationships no
 * single file shows — so rule logic is reused through the shared
 * `AnalysisResult` contract, not duplicated. Fault isolation, the
 * completed/failed event split, and "no persistence by default" mirror the
 * engine exactly; cross-file evidence is represented explicitly as
 * `Evidence` with `filePath`s spanning files, and dependency conclusions
 * are paired with the graph coverage they were drawn from.
 */
export class AnalyzeProject {
  private readonly catalog: ProjectRuleCatalog;
  private readonly generateId: IdGenerator;

  constructor(
    catalog: ProjectRuleCatalog,
    options?: { readonly generateId?: IdGenerator },
  ) {
    this.catalog = catalog;
    this.generateId = options?.generateId ?? randomId;
  }

  async execute(request: ProjectAnalysisRequest): Promise<ProjectAnalysis> {
    const startedAt = Date.now();
    const analysisId = this.generateId();
    const rules = await this.catalog.all();
    const selected = selectRules(rules, request.ruleIds);
    const coverage = graphCoverage(request.graph, request.project.filePaths());
    const analyzedFileCount = request.graph.nodes.filter(
      (node) => request.project.find(node) !== undefined,
    ).length;

    if (request.retainArtifacts === true && request.artifactStore === undefined) {
      throw new InvalidProjectAnalysisError(
        "retainArtifacts requires an artifactStore.",
      );
    }
    if (request.artifactStore !== undefined && request.tenantId.trim().length === 0) {
      throw new InvalidProjectAnalysisError(
        "tenantId must not be empty when an artifactStore is configured.",
      );
    }

    const requested: NewEvent<ProjectEventPayload> = {
      eventId: this.generateId(),
      eventType: PROJECT_ANALYSIS_REQUESTED_EVENT,
      eventVersion: 1,
      correlationId: analysisId,
      causationId: analysisId,
      payload: {
        fileCount: request.project.fileCount,
        languages: request.project.languages(),
        filePaths: request.project.filePaths(),
        ruleIds: selected.map((entry) => entry.id),
      },
    };

    // The configuration guard above rejected `retainArtifacts` without a
    // store, so reaching here with retention requested means the store
    // below is configured.
    const artifactStore =
      request.retainArtifacts === true ? request.artifactStore : undefined;
    if (artifactStore !== undefined) {
      await artifactStore.put(
        request.tenantId,
        analysisId,
        request.project.files.map((file) => file.toReference()),
        Date.now(),
      );
    }

    const outcomes = await Promise.all(
      selected.map((entry) =>
        this.run(
          entry,
          request.project,
          request.graph,
          coverage,
          analyzedFileCount,
          analysisId,
          requested.eventId,
        ),
      ),
    );

    const results = outcomes.map((outcome) => outcome.result);
    const metrics = unwrap(
      ProjectMetrics.of({
        fileCount: request.project.fileCount,
        analyzedFileCount,
        graphCoverage: coverage,
        findingsWithCrossFileEvidence: results.filter(isCrossFileFinding).length,
        totalFindings: results.filter((result) => result.status === "violation").length,
        durationMs: Date.now() - startedAt,
      }),
    );

    return {
      analysisId,
      results,
      events: [requested, ...outcomes.map((outcome) => outcome.event)],
      metrics,
    };
  }

  private async run(
    entry: SelectedRule,
    project: Project,
    graph: DependencyGraph,
    coverage: number,
    analyzedFileCount: number,
    analysisId: string,
    causationId: string,
  ): Promise<ProjectRuleOutcome> {
    if (!entry.rule) {
      return this.fail(
        entry.id,
        analysisId,
        causationId,
        `No project rule is registered for id "${entry.id}".`,
      );
    }

    try {
      const outcome = await entry.rule.evaluate(project, graph);

      if (!(outcome instanceof AnalysisResult)) {
        return this.fail(
          entry.id,
          analysisId,
          causationId,
          `Project rule "${entry.id}" did not return a valid AnalysisResult.`,
        );
      }

      const event: NewEvent<ProjectEventPayload> = {
        eventId: this.generateId(),
        eventType: PROJECT_ANALYSIS_COMPLETED_EVENT,
        eventVersion: 1,
        correlationId: analysisId,
        causationId,
        payload: {
          ruleId: entry.id,
          fileCount: project.fileCount,
          analyzedFileCount,
          graphCoverage: coverage,
          status: outcome.status,
          method: outcome.method,
          confidence: outcome.confidence.value,
        },
      };

      return { result: outcome, event };
    } catch (error) {
      return this.fail(
        entry.id,
        analysisId,
        causationId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private fail(
    ruleId: string,
    analysisId: string,
    causationId: string,
    reason: string,
  ): ProjectRuleOutcome {
    const result = unwrap(
      AnalysisResult.of({
        ruleId,
        status: "unable_to_analyze",
        confidence: unwrap(Confidence.of(0)),
        method: "heuristic",
        evidence: [],
        explanation: `The project engine could not obtain a verdict from this rule: ${reason}`,
        language: "project",
        analyzer: PROJECT_ENGINE_ANALYZER,
        limitations: [
          "Synthesized by the project engine after the rule failed to run; not the rule's own judgment.",
        ],
        humanReviewRecommended: true,
      }),
    );

    const event: NewEvent<ProjectEventPayload> = {
      eventId: this.generateId(),
      eventType: PROJECT_ANALYSIS_FAILED_EVENT,
      eventVersion: 1,
      correlationId: analysisId,
      causationId,
      payload: { ruleId, reason },
    };

    return { result, event };
  }
}

/** A finding whose evidence spans more than one file (#38 "cross-file evidence is represented explicitly"). */
function isCrossFileFinding(result: AnalysisResult): boolean {
  if (result.status !== "violation") {
    return false;
  }
  const files = new Set<string>();
  for (const evidence of result.evidence) {
    if (evidence.location.filePath !== undefined) {
      files.add(evidence.location.filePath);
    }
  }
  return files.size > 1;
}

interface SelectedRule {
  readonly id: string;
  readonly rule: ProjectRule | undefined;
}

function selectRules(
  rules: readonly ProjectRule[],
  ruleIds: readonly string[] | undefined,
): readonly SelectedRule[] {
  if (!ruleIds) {
    return rules.map((rule) => ({ id: rule.id, rule }));
  }

  return ruleIds.map((id) => ({
    id,
    rule: rules.find((rule) => rule.id === id),
  }));
}
