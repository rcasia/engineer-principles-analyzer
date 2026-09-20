import type { ProjectFileReference } from "../domain/project-file.ts";
import {
  InvalidArtifactStoreError,
  type ProjectArtifactStore,
} from "../application/project-artifact-store.port.ts";

/**
 * Driven adapter backed by memory. Stores file references — never source —
 * keyed by tenant and project, so records under one tenant are invisible to
 * every other tenant (#38 "tenant isolation ... before private repository
 * data is persisted").
 *
 * A test double in shape but a real adapter in behavior: the same port a
 * production adapter (encrypted storage with retention sweeps, #28) will
 * implement. Deletion is explicit via `deleteProject`, reporting whether
 * anything was removed so retention enforcement stays observable.
 */
export class InMemoryProjectArtifactStore implements ProjectArtifactStore {
  private readonly records = new Map<
    string,
    { readonly files: readonly ProjectFileReference[]; readonly storedAtMs: number }
  >();

  async put(
    tenantId: string,
    projectId: string,
    files: readonly ProjectFileReference[],
    storedAtMs: number,
  ): Promise<void> {
    requireTenant(tenantId);
    if (projectId.trim().length === 0) {
      throw new InvalidArtifactStoreError("projectId must not be empty.");
    }

    this.records.set(key(tenantId, projectId), {
      files: files.map((file) => ({ ...file })),
      storedAtMs,
    });
  }

  async fileReferences(
    tenantId: string,
    projectId: string,
  ): Promise<readonly ProjectFileReference[] | undefined> {
    requireTenant(tenantId);
    const record = this.records.get(key(tenantId, projectId));
    return record === undefined
      ? undefined
      : record.files.map((file) => ({ ...file }));
  }

  async deleteProject(tenantId: string, projectId: string): Promise<boolean> {
    requireTenant(tenantId);
    return this.records.delete(key(tenantId, projectId));
  }
}

function key(tenantId: string, projectId: string): string {
  return JSON.stringify([tenantId, projectId]);
}

function requireTenant(tenantId: string): void {
  if (tenantId.trim().length === 0) {
    throw new InvalidArtifactStoreError("tenantId must not be empty.");
  }
}
