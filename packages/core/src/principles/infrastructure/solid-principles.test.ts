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
      { id: "solid.srp", title: "Single Responsibility Principle" },
      { id: "solid.ocp", title: "Open/Closed Principle" },
      { id: "solid.lsp", title: "Liskov Substitution Principle" },
      { id: "solid.isp", title: "Interface Segregation Principle" },
      { id: "solid.dip", title: "Dependency Inversion Principle" },
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
});
