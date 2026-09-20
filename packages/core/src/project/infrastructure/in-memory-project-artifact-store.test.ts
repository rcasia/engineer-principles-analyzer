import { describe, expect, it } from "bun:test";
import { InvalidArtifactStoreError } from "../application/project-artifact-store.port.ts";
import type { ProjectFileReference } from "../domain/project-file.ts";
import { InMemoryProjectArtifactStore } from "./in-memory-project-artifact-store.ts";

function reference(path: string): ProjectFileReference {
  return { path, language: "typescript", sourceLength: 18, contentHash: "abcd1234" };
}

describe("InMemoryProjectArtifactStore", () => {
  it("round-trips the references it was given", async () => {
    const store = new InMemoryProjectArtifactStore();
    const files = [reference("a.ts"), reference("b.ts")];

    await store.put("tenant-a", "project-1", files, 1_000);

    expect(await store.fileReferences("tenant-a", "project-1")).toEqual(files);
  });

  it("returns undefined for an unknown project", async () => {
    const store = new InMemoryProjectArtifactStore();

    expect(await store.fileReferences("tenant-a", "missing")).toBeUndefined();
  });

  it("isolates tenants: one tenant cannot read another's artifacts", async () => {
    const store = new InMemoryProjectArtifactStore();

    await store.put("tenant-a", "project-1", [reference("a.ts")], 1_000);

    expect(await store.fileReferences("tenant-b", "project-1")).toBeUndefined();
    expect(await store.deleteProject("tenant-b", "project-1")).toBe(false);
    expect(await store.fileReferences("tenant-a", "project-1")).toEqual([
      reference("a.ts"),
    ]);
  });

  it("treats tenant ids that merely look alike as different tenants", async () => {
    const store = new InMemoryProjectArtifactStore();

    await store.put("a b", "c", [reference("a.ts")], 1_000);

    expect(await store.fileReferences("a", "b c")).toBeUndefined();
  });

  it("deletes a project and reports whether anything was removed", async () => {
    const store = new InMemoryProjectArtifactStore();

    await store.put("tenant-a", "project-1", [reference("a.ts")], 1_000);

    expect(await store.deleteProject("tenant-a", "project-1")).toBe(true);
    expect(await store.fileReferences("tenant-a", "project-1")).toBeUndefined();
    expect(await store.deleteProject("tenant-a", "project-1")).toBe(false);
  });

  it("copies on write and read so callers cannot mutate stored records", async () => {
    const store = new InMemoryProjectArtifactStore();
    const files = [reference("a.ts")];

    await store.put("tenant-a", "project-1", files, 1_000);
    files.push(reference("b.ts"));
    const read = (await store.fileReferences(
      "tenant-a",
      "project-1",
    )) as ProjectFileReference[];
    read.push(reference("c.ts"));

    expect(await store.fileReferences("tenant-a", "project-1")).toEqual([
      reference("a.ts"),
    ]);
  });

  it("rejects a blank tenant on every operation", async () => {
    const store = new InMemoryProjectArtifactStore();

    await expect(store.put("   ", "project-1", [], 0)).rejects.toEqual(
      new InvalidArtifactStoreError("tenantId must not be empty."),
    );
    await expect(store.fileReferences("", "project-1")).rejects.toEqual(
      new InvalidArtifactStoreError("tenantId must not be empty."),
    );
    await expect(store.deleteProject("", "project-1")).rejects.toEqual(
      new InvalidArtifactStoreError("tenantId must not be empty."),
    );
  });

  it("rejects a blank project id on put", async () => {
    const store = new InMemoryProjectArtifactStore();

    await expect(store.put("tenant-a", "  ", [], 0)).rejects.toEqual(
      new InvalidArtifactStoreError("projectId must not be empty."),
    );
  });

  it("names its error so callers can discriminate it", () => {
    expect(new InvalidArtifactStoreError("boom").name).toBe(
      "InvalidArtifactStoreError",
    );
  });
});
