import { describe, expect, it } from "bun:test";
import { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import { Confidence } from "../../analysis/domain/confidence.ts";
import { Evidence } from "../../analysis/domain/evidence.ts";
import { SourceLocation } from "../../analysis/domain/source-location.ts";
import { unwrap } from "../../shared/result.ts";
import { DependencyGraph } from "../domain/dependency-graph.ts";
import {
  PROJECT_ANALYSIS_COMPLETED_EVENT,
  PROJECT_ANALYSIS_FAILED_EVENT,
  PROJECT_ANALYSIS_REQUESTED_EVENT,
} from "../domain/project-event.ts";
import { ProjectFile } from "../domain/project-file.ts";
import { Project } from "../domain/project.ts";
import { InMemoryProjectArtifactStore } from "../infrastructure/in-memory-project-artifact-store.ts";
import { InMemoryProjectRuleCatalog } from "../infrastructure/in-memory-project-rule-catalog.ts";
import {
  AnalyzeProject,
  InvalidProjectAnalysisError,
} from "./analyze-project.use-case.ts";
import type { ProjectRule } from "./project-rule.port.ts";

function projectFile(path: string, sourceCode: string): ProjectFile {
  return unwrap(ProjectFile.of({ path, language: "typescript", sourceCode }));
}

function project(): Project {
  return unwrap(
    Project.of([
      projectFile("a.ts", "secret-source-alpha"),
      projectFile("b.ts", "secret-source-beta"),
      projectFile("c.ts", "secret-source-gamma"),
    ]),
  );
}

function fullGraph(): DependencyGraph {
  return unwrap(
    DependencyGraph.of({
      nodes: ["a.ts", "b.ts", "c.ts"],
      edges: [{ from: "a.ts", to: "b.ts" }],
    }),
  );
}

function partialGraph(): DependencyGraph {
  return unwrap(
    DependencyGraph.of({
      nodes: ["a.ts", "b.ts"],
      edges: [{ from: "a.ts", to: "b.ts" }],
    }),
  );
}

function compliantResult(ruleId: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId,
      status: "compliant",
      confidence: unwrap(Confidence.of(0.5)),
      method: "heuristic",
      evidence: [],
      explanation: "Nothing depends the wrong way.",
      language: "typescript",
      analyzer: { name: "test-rule", version: "1" },
      humanReviewRecommended: false,
    }),
  );
}

function crossFileViolation(ruleId: string): AnalysisResult {
  return unwrap(
    AnalysisResult.of({
      ruleId,
      status: "violation",
      confidence: unwrap(Confidence.of(1)),
      method: "deterministic",
      evidence: [
        unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ filePath: "a.ts", startLine: 1 })),
            excerpt: "import b from './b.ts'",
          }),
        ),
        unwrap(
          Evidence.of({
            location: unwrap(SourceLocation.of({ filePath: "b.ts", startLine: 2 })),
            excerpt: "exported symbol used by a.ts",
          }),
        ),
      ],
      explanation: "a.ts reaches a forbidden module through b.ts.",
      language: "typescript",
      analyzer: { name: "test-rule", version: "1" },
      humanReviewRecommended: false,
    }),
  );
}

const compliantRule: ProjectRule = {
  id: "test.compliant",
  evaluate: () => Promise.resolve(compliantResult("test.compliant")),
};

const crossFileRule: ProjectRule = {
  id: "test.cross-file",
  evaluate: (_project, graph) => {
    if (!graph.nodes.includes("a.ts")) {
      return Promise.reject(new Error("graph does not cover a.ts"));
    }
    return Promise.resolve(crossFileViolation("test.cross-file"));
  },
};

const throwingRule: ProjectRule = {
  id: "test.throwing",
  evaluate: () => Promise.reject(new Error("boom")),
};

function sequentialIds(): { readonly generateId: () => string } {
  let next = 1;
  return {
    generateId: () => `id-${next++}`,
  };
}

describe("AnalyzeProject", () => {
  it("runs every rule and reports one result per rule in order", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule, crossFileRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
    });

    expect(run.analysisId).toBe("id-1");
    expect(run.results.map((result) => result.ruleId)).toEqual([
      "test.compliant",
      "test.cross-file",
    ]);
    expect(run.results.map((result) => result.status)).toEqual([
      "compliant",
      "violation",
    ]);
    expect(run.events.map((event) => event.eventType)).toEqual([
      PROJECT_ANALYSIS_REQUESTED_EVENT,
      PROJECT_ANALYSIS_COMPLETED_EVENT,
      PROJECT_ANALYSIS_COMPLETED_EVENT,
    ]);
  });

  it("describes the request with counts and paths, never source", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
    });

    expect(run.events[0]).toEqual({
      eventId: "id-2",
      eventType: PROJECT_ANALYSIS_REQUESTED_EVENT,
      eventVersion: 1,
      correlationId: "id-1",
      causationId: "id-1",
      payload: {
        fileCount: 3,
        languages: ["typescript"],
        filePaths: ["a.ts", "b.ts", "c.ts"],
        ruleIds: ["test.compliant"],
      },
    });
    expect(JSON.stringify(run.events)).not.toContain("secret-source-alpha");
    expect(JSON.stringify(run.events)).not.toContain("secret-source-beta");
    expect(JSON.stringify(run.events)).not.toContain("secret-source-gamma");
  });

  it("records per-rule completions with coverage facts", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: partialGraph(),
      tenantId: "tenant-a",
    });

    expect(run.events[1]).toEqual({
      eventId: "id-3",
      eventType: PROJECT_ANALYSIS_COMPLETED_EVENT,
      eventVersion: 1,
      correlationId: "id-1",
      causationId: "id-2",
      payload: {
        ruleId: "test.compliant",
        fileCount: 3,
        analyzedFileCount: 2,
        graphCoverage: 2 / 3,
        status: "compliant",
        method: "heuristic",
        confidence: 0.5,
      },
    });
  });

  it("isolates a throwing rule without losing the other results", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule, throwingRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
    });

    expect(run.results[1]?.status).toBe("unable_to_analyze");
    expect(run.results[1]?.analyzer).toEqual({
      name: "principled-project-engine",
      version: "1",
    });
    expect(run.results[0]?.status).toBe("compliant");
    expect(run.events[2]).toEqual({
      eventId: "id-4",
      eventType: PROJECT_ANALYSIS_FAILED_EVENT,
      eventVersion: 1,
      correlationId: "id-1",
      causationId: "id-2",
      payload: { ruleId: "test.throwing", reason: "boom" },
    });
  });

  it("fails an unknown rule id without running anything else into the ground", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
      ruleIds: ["test.missing"],
    });

    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.events[1]?.payload).toEqual({
      ruleId: "test.missing",
      reason: 'No project rule is registered for id "test.missing".',
    });
  });

  it("fails a rule that returns a non-result value", async () => {
    const badRule = {
      id: "test.bad",
      evaluate: () => Promise.resolve({ not: "a result" }),
    } as unknown as ProjectRule;
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([badRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
    });

    expect(run.results[0]?.status).toBe("unable_to_analyze");
    expect(run.events[1]?.payload).toEqual({
      ruleId: "test.bad",
      reason: 'Project rule "test.bad" did not return a valid AnalysisResult.',
    });
  });

  it("reports file, graph and cross-file evidence coverage", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule, crossFileRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: partialGraph(),
      tenantId: "tenant-a",
    });

    expect(run.metrics.fileCount).toBe(3);
    expect(run.metrics.graphCoverage).toBe(2 / 3);
    expect(run.metrics.fileCoverage).toBe(2 / 3);
    expect(run.metrics.totalFindings).toBe(1);
    expect(run.metrics.crossFileEvidenceCoverage).toBe(1);
  });

  it("stores references tenant-scoped when retention is requested, never source", async () => {
    const store = new InMemoryProjectArtifactStore();
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
      retainArtifacts: true,
      artifactStore: store,
    });

    const stored = await store.fileReferences("tenant-a", run.analysisId);
    expect(stored?.map((file) => file.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(JSON.stringify(stored)).not.toContain("secret-source-alpha");
    expect(await store.fileReferences("tenant-b", run.analysisId)).toBeUndefined();
  });

  it("persists nothing by default", async () => {
    const store = new InMemoryProjectArtifactStore();
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    const run = await useCase.execute({
      project: project(),
      graph: fullGraph(),
      tenantId: "tenant-a",
      artifactStore: store,
    });

    expect(await store.fileReferences("tenant-a", run.analysisId)).toBeUndefined();
  });

  it("rejects retention without a store as a configuration error", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    await expect(
      useCase.execute({
        project: project(),
        graph: fullGraph(),
        tenantId: "tenant-a",
        retainArtifacts: true,
      }),
    ).rejects.toEqual(
      new InvalidProjectAnalysisError("retainArtifacts requires an artifactStore."),
    );
  });

  it("rejects a configured store without a tenant as a configuration error", async () => {
    const useCase = new AnalyzeProject(
      new InMemoryProjectRuleCatalog([compliantRule]),
      sequentialIds(),
    );

    await expect(
      useCase.execute({
        project: project(),
        graph: fullGraph(),
        tenantId: "   ",
        artifactStore: new InMemoryProjectArtifactStore(),
      }),
    ).rejects.toEqual(
      new InvalidProjectAnalysisError(
        "tenantId must not be empty when an artifactStore is configured.",
      ),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidProjectAnalysisError("boom").name).toBe(
      "InvalidProjectAnalysisError",
    );
  });
});
