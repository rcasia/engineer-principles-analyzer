import { describe, expect, it } from "bun:test";
import { DIP_RULE_ID } from "../dip/infrastructure/dip-rule.ts";
import { ISP_RULE_ID } from "../isp/infrastructure/isp-rule.ts";
import { LSP_RULE_ID } from "../lsp/infrastructure/lsp-rule.ts";
import { OCP_RULE_ID } from "../ocp/infrastructure/ocp-rule.ts";
import { SRP_RULE_ID } from "../srp/infrastructure/srp-rule.ts";
import { SOLID_PRINCIPLES } from "./solid-principles.ts";

describe("SOLID_PRINCIPLES", () => {
  it("lists the five shipped SOLID principles in SRP-to-DIP order", () => {
    expect(SOLID_PRINCIPLES).toEqual([
      {
        id: "solid.srp",
        title: "Single Responsibility Principle",
        summary: "A class should have one responsibility — one reason to change.",
        whyItMatters:
          "Mixed responsibilities couple unrelated changes: a persistence tweak risks breaking rendering, and the class becomes hard to name, test, and reuse.",
        howChecked:
          "Groups top-level method names into responsibility domains such as persistence, communication, and presentation; three or more domains is a violation, two is uncertain.",
        fixDirection:
          "Extract each secondary domain into its own collaborator class (a module in Python) so every class keeps a single axis of change.",
      },
      {
        id: "solid.ocp",
        title: "Open/Closed Principle",
        summary:
          "Software should be open for extension but closed for modification — add new behaviour with new code, not by editing existing branches.",
        whyItMatters:
          "Every edit to a shared branch risks all existing cases; extension points let new cases land without re-testing the old ones.",
        howChecked:
          "Counts switch statements, else-if chains, and typeof/instanceof type guards; three or more signals is a violation, two is uncertain.",
        fixDirection:
          "Replace type-based dispatch with polymorphism or a handler registry so a new case adds code instead of editing existing branches.",
      },
      {
        id: "solid.lsp",
        title: "Liskov Substitution Principle",
        summary:
          "Subtypes must be substitutable for their base types — callers using the parent should never be surprised by a subclass.",
        whyItMatters:
          "A subclass that refuses what its parent promised breaks every caller written against the parent contract.",
        howChecked:
          "Compares overrides against parents defined in the same file and flags overrides that throw where the parent did not; two or more is a violation, one is uncertain.",
        fixDirection:
          "Honour the parent contract in the override instead of throwing, or narrow the hierarchy so the subclass is never used where the parent is expected.",
      },
      {
        id: "solid.isp",
        title: "Interface Segregation Principle",
        summary:
          "Clients should not depend on operations they do not use — prefer small, consumer-specific interfaces over one broad one.",
        whyItMatters:
          "A broad interface forces every client to absorb changes to operations it never calls, and hides the real consumer groupings.",
        howChecked:
          "Counts top-level members of each interface or object type; seven or more members is a violation, five or six is uncertain, four or fewer is compliant.",
        fixDirection:
          "Split the broad interface by consumer: group related operations behind narrower interfaces so each client depends only on what it uses.",
      },
      {
        id: "solid.dip",
        title: "Dependency Inversion Principle",
        summary:
          "High-level logic should depend on abstractions it owns, not on concrete infrastructure — depend on ports, not clients, pools, or brokers.",
        whyItMatters:
          "Naming infrastructure directly welds business logic to a specific database, SDK, or broker; every vendor change ripples through the code.",
        howChecked:
          "Counts imports of known infrastructure modules and direct instantiations of concrete infrastructure names; two or more signals is a violation, one is uncertain.",
        fixDirection:
          "Inject the infrastructure behind an abstraction your code owns so high-level logic never names a concrete client, pool, or broker.",
      },
    ]);
  });

  it("uses the same ids as the rules the findings already cite", () => {
    expect(SOLID_PRINCIPLES.map((principle) => principle.id)).toEqual([
      SRP_RULE_ID,
      OCP_RULE_ID,
      LSP_RULE_ID,
      ISP_RULE_ID,
      DIP_RULE_ID,
    ]);
    expect(SRP_RULE_ID).toBe("solid.srp");
    expect(OCP_RULE_ID).toBe("solid.ocp");
    expect(LSP_RULE_ID).toBe("solid.lsp");
    expect(ISP_RULE_ID).toBe("solid.isp");
    expect(DIP_RULE_ID).toBe("solid.dip");
  });

  it("titles each principle with its canonical SOLID name", () => {
    expect(SOLID_PRINCIPLES.map((principle) => principle.title)).toEqual([
      "Single Responsibility Principle",
      "Open/Closed Principle",
      "Liskov Substitution Principle",
      "Interface Segregation Principle",
      "Dependency Inversion Principle",
    ]);
  });

  it("explains every principle with a summary, stakes, check, and fix", () => {
    for (const principle of SOLID_PRINCIPLES) {
      expect(principle.summary.length).toBeGreaterThan(20);
      expect(principle.whyItMatters.length).toBeGreaterThan(20);
      expect(principle.howChecked.length).toBeGreaterThan(20);
      expect(principle.fixDirection.length).toBeGreaterThan(20);
    }

    expect(new Set(SOLID_PRINCIPLES.map((p) => p.summary)).size).toBe(5);
  });
});
