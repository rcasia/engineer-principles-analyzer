import { describe, expect, it } from "bun:test";
import { unwrap } from "../../shared/result.ts";
import { Subject } from "../../engine/domain/subject.ts";
import {
  ARCHITECTURE_DEPENDENCY_RULE_ID,
  ArchitectureDependencyRule,
} from "./architecture-dependency-rule.ts";

describe("ArchitectureDependencyRule", () => {
  it("reports not_applicable for single-file subjects, naming the gap", async () => {
    const subject = unwrap(
      Subject.of({ sourceCode: "import b from './b';", language: "typescript" }),
    );

    const result = await new ArchitectureDependencyRule().evaluate(subject);

    expect(result.ruleId).toBe(ARCHITECTURE_DEPENDENCY_RULE_ID);
    expect(ARCHITECTURE_DEPENDENCY_RULE_ID).toBe("architecture.dependency");
    expect(result.status).toBe("not_applicable");
    expect(result.language).toBe("typescript");
    expect(result.explanation).toBe(
      "Cross-file dependency rules require project scope with a dependency graph; a single file provides no observable dependency edges.",
    );
    expect(result.limitations).toEqual([
      "Single-file analysis cannot observe cross-file dependencies; run project-level analysis for dependency conclusions.",
    ]);
    expect(result.humanReviewRecommended).toBe(false);
  });
});
