import { describe, expect, it } from "bun:test";
import type { Principle } from "@principled/core";
import { renderPrinciples } from "./render-principles.ts";

const tdd: Principle = {
  id: "tdd",
  title: "Test Driven Development",
  summary: "Write the failing test before the implementation.",
  whyItMatters: "Without it, untested paths accumulate silently.",
  howChecked: "Not checked by the analyzer; a catalog placeholder.",
  fixDirection: "Add the missing test first, then make it pass.",
};
const ci: Principle = {
  id: "ci",
  title: "Continuous Integration",
  summary: "Merge every change to main daily.",
  whyItMatters: "Long-lived branches hide integration risk.",
  howChecked: "Not checked by the analyzer; a catalog placeholder.",
  fixDirection: "Integrate the branch and run the checks.",
};

describe("renderPrinciples", () => {
  it("says so when there is nothing to show", () => {
    expect(renderPrinciples([])).toBe("No principles are defined yet.");
  });

  it("renders a single principle as an id and title bullet", () => {
    expect(renderPrinciples([tdd])).toBe(
      "- tdd: Test Driven Development\n  Write the failing test before the implementation.",
    );
  });

  it("puts each principle on its own line, in catalog order", () => {
    expect(renderPrinciples([tdd, ci])).toBe(
      "- tdd: Test Driven Development\n  Write the failing test before the implementation.\n- ci: Continuous Integration\n  Merge every change to main daily.",
    );
  });
});
