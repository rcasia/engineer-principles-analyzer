import { describe, expect, it } from "bun:test";
import type { ProjectRule } from "../application/project-rule.port.ts";
import { InMemoryProjectRuleCatalog } from "./in-memory-project-rule-catalog.ts";

const first: ProjectRule = {
  id: "test.first",
  evaluate: () => Promise.reject(new Error("not implemented")),
};
const second: ProjectRule = {
  id: "test.second",
  evaluate: () => Promise.reject(new Error("not implemented")),
};

describe("InMemoryProjectRuleCatalog", () => {
  it("ships no rules by default", async () => {
    expect(await new InMemoryProjectRuleCatalog().all()).toEqual([]);
  });

  it("returns the rules it was seeded with", async () => {
    expect(await new InMemoryProjectRuleCatalog([first, second]).all()).toEqual([
      first,
      second,
    ]);
  });

  it("copies the seed so later caller mutations cannot leak in", async () => {
    const seed: ProjectRule[] = [first];
    const catalog = new InMemoryProjectRuleCatalog(seed);

    seed.push(second);

    expect(await catalog.all()).toEqual([first]);
  });

  it("copies on read so callers cannot mutate the catalog", async () => {
    const catalog = new InMemoryProjectRuleCatalog([first]);

    (await (catalog.all() as Promise<ProjectRule[]>)).push(second);

    expect(await catalog.all()).toEqual([first]);
  });
});
