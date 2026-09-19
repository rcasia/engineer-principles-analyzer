import type { AnalysisResult } from "../../analysis/domain/analysis-result.ts";
import type { Subject } from "../domain/subject.ts";

/**
 * Driven port: one independently executable unit of judgment against a
 * {@link Subject}.
 *
 * Every SOLID principle (#10-#14) and every principle beyond it implements
 * this port as its own adapter; the engine (`AnalyzeSubject`) does not know
 * or care how a rule reaches its verdict, only that it eventually returns
 * one `AnalysisResult` — the contract both the CLI and web UI render (#8).
 *
 * `evaluate` is allowed to reject or throw: a rule is not trusted code, and
 * isolating that failure so it cannot take down the whole run is the
 * engine's job, not the port's (ADR-0013, "one rule's uncaught throw must
 * not be able to take down the whole evaluation run").
 */
export interface Rule {
  /** Stable identifier, e.g. `"solid.srp"`. Matches `AnalysisResult.ruleId`. */
  readonly id: string;
  evaluate(subject: Subject): Promise<AnalysisResult>;
}
