import { describe, expect, it } from "bun:test";
import type { Principle } from "../domain/principle.ts";
import { InMemoryPrincipleCatalog } from "./in-memory-principle-catalog.ts";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };
const ci: Principle = { id: "ci", title: "Continuous Integration" };

describe("InMemoryPrincipleCatalog", () => {
  it("ships no principles by default", async () => {
    expect(await new InMemoryPrincipleCatalog().all()).toEqual([]);
  });

  it("returns the principles it was seeded with", async () => {
    expect(await new InMemoryPrincipleCatalog([tdd, ci]).all()).toEqual([
      tdd,
      ci,
    ]);
  });

  it("copies the seed so later caller mutations cannot leak in", async () => {
    const seed: Principle[] = [tdd];
    const catalog = new InMemoryPrincipleCatalog(seed);

    seed.push(ci);

    expect(await catalog.all()).toEqual([tdd]);
  });

  it("copies on read so callers cannot mutate the catalog", async () => {
    const catalog = new InMemoryPrincipleCatalog([tdd]);

    (await catalog.all() as Principle[]).push(ci);

    expect(await catalog.all()).toEqual([tdd]);
  });
});
