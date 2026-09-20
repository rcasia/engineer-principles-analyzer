import type { ProjectFileReference } from "../domain/project-file.ts";

export class InvalidArtifactStoreError extends Error {
  override readonly name = "InvalidArtifactStoreError";
}

/**
 * Driven port: erasable storage for repository-derived artifacts (#22
 * "retention/deletion behavior for repository artifacts separately from
 * immutable event metadata", #38 "tenant isolation ... before private
 * repository data is persisted").
 *
 * Three rules every implementation must hold, tested against the in-memory
 * adapter:
 *
 * - **References only.** `put` receives `ProjectFileReference` values —
 *   paths, languages, lengths and hashes — never source text. The port has
 *   no shape that could carry source, so an adapter cannot become a second
 *   copy of customer code by accident.
 * - **Tenant-scoped.** Every operation takes `tenantId`, and records stored
 *   under one tenant are invisible to every other tenant.
 * - **Deletable.** `deleteProject` removes a project's artifacts and reports
 *   whether anything was removed, so retention sweeps and erasure requests
 *   are observable, not hopeful.
 */
export interface ProjectArtifactStore {
  put(
    tenantId: string,
    projectId: string,
    files: readonly ProjectFileReference[],
    storedAtMs: number,
  ): Promise<void>;
  fileReferences(
    tenantId: string,
    projectId: string,
  ): Promise<readonly ProjectFileReference[] | undefined>;
  deleteProject(tenantId: string, projectId: string): Promise<boolean>;
}
