import { describe, expect, it } from "bun:test";
import type { Rule } from "../application/rule.port.ts";
import { InMemoryRuleCatalog } from "./in-memory-rule-catalog.ts";

const srp: Rule = {
  id: "solid.srp",
  evaluate: () => Promise.reject(new Error("not implemented")),
};
const ocp: Rule = {
  id: "solid.ocp",
  evaluate: () => Promise.reject(new Error("not implemented")),
};

describe("InMemoryRuleCatalog", () => {
  it("ships no rules by default", async () => {
    expect(await new InMemoryRuleCatalog().all()).toEqual([]);
  });

  it("returns the rules it was seeded with", async () => {
    expect(await new InMemoryRuleCatalog([srp, ocp]).all()).toEqual([
      srp,
      ocp,
    ]);
  });

  it("copies the seed so later caller mutations cannot leak in", async () => {
    const seed: Rule[] = [srp];
    const catalog = new InMemoryRuleCatalog(seed);

    seed.push(ocp);

    expect(await catalog.all()).toEqual([srp]);
  });

  it("copies on read so callers cannot mutate the catalog", async () => {
    const catalog = new InMemoryRuleCatalog([srp]);

    (await (catalog.all() as Promise<Rule[]>)).push(ocp);

    expect(await catalog.all()).toEqual([srp]);
  });
});
