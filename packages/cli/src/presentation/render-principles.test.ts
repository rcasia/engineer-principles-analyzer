import { describe, expect, it } from "bun:test";
import type { Principle } from "@principled/core";
import { renderPrinciples } from "./render-principles.ts";

const tdd: Principle = { id: "tdd", title: "Test Driven Development" };
const ci: Principle = { id: "ci", title: "Continuous Integration" };

describe("renderPrinciples", () => {
  it("says so when there is nothing to show", () => {
    expect(renderPrinciples([])).toBe("No principles are defined yet.");
  });

  it("renders a single principle as an id and title bullet", () => {
    expect(renderPrinciples([tdd])).toBe("- tdd: Test Driven Development");
  });

  it("puts each principle on its own line, in catalog order", () => {
    expect(renderPrinciples([tdd, ci])).toBe(
      "- tdd: Test Driven Development\n- ci: Continuous Integration",
    );
  });
});
