/**
 * Driven port for the engineering/evaluation metrics #9 asks the engine to
 * expose: analysis latency, rule execution latency, rule execution
 * failures, throughput, and result-contract validity.
 *
 * Every hook is optional, and `AnalyzeSubject` defaults to an instance with
 * none of them implemented. The engine never emits telemetry on its own —
 * only a caller that explicitly injects an implementation (a CLI or web
 * composition root) decides where these facts go, and the core package
 * never imports a metrics backend to make that decision for it.
 */
export interface EngineInstrumentation {
  /** Wall-clock time to run every selected rule for one `execute` call. */
  recordAnalysisLatency?(durationMs: number): void;
  /** Wall-clock time for one rule's `evaluate` call, success or failure. */
  recordRuleLatency?(ruleId: string, durationMs: number): void;
  /** Called once per rule that crashed, rejected, was missing, or violated the result contract. */
  recordRuleFailure?(ruleId: string, reason: string): void;
  /** Called once per `execute` call with how many rules it ran. */
  recordThroughput?(ruleCount: number): void;
  /** Whether a rule's settled outcome was a genuine `AnalysisResult`. */
  recordResultContractValidity?(ruleId: string, valid: boolean): void;
}
