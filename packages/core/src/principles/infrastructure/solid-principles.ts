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
 *
 * Each entry carries what a bare id/title list cannot: a plain-language
 * definition, the cost of violating it, the heuristic and thresholds the
 * shipped rule actually applies, and the direction a fix takes. Thresholds
 * mirror the rules (`srp-rule.ts`, `ocp-rule.ts`, `lsp-rule.ts`,
 * `isp-rule.ts`, `dip-rule.ts`) so the catalog never promises a check the
 * analyzer does not run.
 */
export const SOLID_PRINCIPLES: readonly Principle[] = [
  {
    id: SRP_RULE_ID,
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
    id: OCP_RULE_ID,
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
    id: LSP_RULE_ID,
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
    id: ISP_RULE_ID,
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
    id: DIP_RULE_ID,
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
];
