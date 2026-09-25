import type { Principle } from "../domain/principle.ts";
import { DIP_RULE_ID } from "../dip/infrastructure/dip-rule.ts";
import { ISP_RULE_ID } from "../isp/infrastructure/isp-rule.ts";
import { LSP_RULE_ID } from "../lsp/infrastructure/lsp-rule.ts";
import { OCP_RULE_ID } from "../ocp/infrastructure/ocp-rule.ts";
import { SRP_RULE_ID } from "../srp/infrastructure/srp-rule.ts";

/**
 * The shipped principles catalog (#58): the five SOLID principles the
 * analyzer already runs rules for (#10-#14). Seeded into
 * `InMemoryPrincipleCatalog` by the composition roots (cli `main`, web
 * `bin` and `lambda-entry`), so `ListPrinciples` and `GET /principles`
 * name the same contract the findings already cite.
 */
export const SOLID_PRINCIPLES: readonly Principle[] = [
  { id: SRP_RULE_ID, title: "Single Responsibility Principle" },
  { id: OCP_RULE_ID, title: "Open/Closed Principle" },
  { id: LSP_RULE_ID, title: "Liskov Substitution Principle" },
  { id: ISP_RULE_ID, title: "Interface Segregation Principle" },
  { id: DIP_RULE_ID, title: "Dependency Inversion Principle" },
];
