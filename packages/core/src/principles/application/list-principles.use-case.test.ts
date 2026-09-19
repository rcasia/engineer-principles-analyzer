import { describe, expect, it } from "bun:test";
import type { Principle } from "../domain/principle.ts";
import { InMemoryPrincipleCatalog } from "../infrastructure/in-memory-principle-catalog.ts";
import { ListPrinciples } from "./list-principles.use-case.ts";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };

describe("ListPrinciples", () => {
  it("returns every principle in the catalog", async () => {
    const useCase = new ListPrinciples(new InMemoryPrincipleCatalog([tdd]));

    expect(await useCase.execute()).toEqual([tdd]);
  });

  it("returns nothing when the catalog is empty", async () => {
    const useCase = new ListPrinciples(new InMemoryPrincipleCatalog());

    expect(await useCase.execute()).toEqual([]);
  });
});
