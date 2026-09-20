export type { Principle } from "./principles/domain/principle.ts";
export {
  InvalidScoreError,
  MAXIMUM_SCORE,
  MINIMUM_SCORE,
  Score,
} from "./principles/domain/score.ts";
export type { PrincipleCatalog } from "./principles/application/principle-catalog.port.ts";
export { ListPrinciples } from "./principles/application/list-principles.use-case.ts";
export { InMemoryPrincipleCatalog } from "./principles/infrastructure/in-memory-principle-catalog.ts";

// Event sourcing + CQRS foundation (ADR-0012).
export type { EventEnvelope } from "./eventsourcing/domain/event.ts";
export type { Decider } from "./eventsourcing/domain/decider.ts";
export {
  rehydrate,
  rehydrateAt,
} from "./eventsourcing/domain/rehydrate.ts";
export {
  ConcurrencyError,
  type EventStore,
  type NewEvent,
} from "./eventsourcing/application/event-store.port.ts";
export type { Projection } from "./eventsourcing/application/projection.port.ts";
export { Projector } from "./eventsourcing/application/projector.ts";
export {
  type Clock,
  InMemoryEventStore,
} from "./eventsourcing/infrastructure/in-memory-event-store.ts";

// Analysis result contract (ADR-0013).
export {
  AnalysisResult,
  InvalidAnalysisResultError,
} from "./analysis/domain/analysis-result.ts";
export type { AnalysisResultProps } from "./analysis/domain/analysis-result.ts";
export {
  ANALYSIS_STATUSES,
  isAnalysisStatus,
} from "./analysis/domain/analysis-status.ts";
export type { AnalysisStatus } from "./analysis/domain/analysis-status.ts";
export {
  ANALYSIS_METHODS,
  isAnalysisMethod,
} from "./analysis/domain/analysis-method.ts";
export type { AnalysisMethod } from "./analysis/domain/analysis-method.ts";
export {
  Confidence,
  InvalidConfidenceError,
  MAXIMUM_CONFIDENCE,
  MINIMUM_CONFIDENCE,
} from "./analysis/domain/confidence.ts";
export {
  Evidence,
  InvalidEvidenceError,
} from "./analysis/domain/evidence.ts";
export type { EvidenceProps } from "./analysis/domain/evidence.ts";
export {
  InvalidSourceLocationError,
  SourceLocation,
} from "./analysis/domain/source-location.ts";
export type { SourceLocationProps } from "./analysis/domain/source-location.ts";
export type { AnalyzerMetadata } from "./analysis/domain/analyzer-metadata.ts";
export { err, ok, unwrap, unwrapErr, UnwrapError } from "./shared/result.ts";
export type { Result } from "./shared/result.ts";

// Rule evaluation engine (#9).
export { InvalidSubjectError, Subject } from "./engine/domain/subject.ts";
export type { SubjectProps } from "./engine/domain/subject.ts";
export {
  detectLanguage,
  languageForFilename,
  languageForSource,
} from "./engine/domain/language-detection.ts";
export {
  ANALYSIS_COMPLETED_EVENT,
  ANALYSIS_FAILED_EVENT,
  ANALYSIS_REQUESTED_EVENT,
} from "./engine/domain/analysis-event.ts";
export type {
  AnalysisCompletedPayload,
  AnalysisEventPayload,
  AnalysisFailedPayload,
  AnalysisRequestedPayload,
} from "./engine/domain/analysis-event.ts";
export type { Rule } from "./engine/application/rule.port.ts";
export type { RuleCatalog } from "./engine/application/rule-catalog.port.ts";
export type { EngineInstrumentation } from "./engine/application/instrumentation.port.ts";
export {
  AnalyzeSubject,
  type AnalysisRequest,
  type AnalysisRun,
  type IdGenerator,
} from "./engine/application/analyze-subject.use-case.ts";
export { InMemoryRuleCatalog } from "./engine/infrastructure/in-memory-rule-catalog.ts";

// Single Responsibility Principle rule (#10, ADR-0022).
export { SRP_RULE_ID, SrpRule } from "./principles/srp/infrastructure/srp-rule.ts";

// Jev adapter: AI-assisted judgments behind an injected port (ADR-0024).
export type {
  ChoiceJudgment,
  ChoiceQuestion,
  JevClient,
  NoulJudgment,
  NoulQuestion,
} from "./jev/application/jev-client.port.ts";
export { JevTransportError } from "./jev/application/jev-client.port.ts";
export { excerptForEvidence } from "./jev/domain/evidence-excerpt.ts";
export type { SourceExcerpt } from "./jev/domain/evidence-excerpt.ts";
export {
  buildChoiceRequestBody,
  buildNoulRequestBody,
  JEV_CHOICE_QUESTION_ID,
  JEV_ENDPOINT,
  JEV_MODEL,
  JEV_NOUL_QUESTION_ID,
} from "./jev/domain/jev-request.ts";
export type {
  ChoiceQuestionShape,
  JevChoiceRequestBody,
  JevNoulRequestBody,
  NoulQuestionShape,
} from "./jev/domain/jev-request.ts";
export {
  InvalidJevResponseError,
  parseChoiceAnswerBody,
  parseNoulAnswerBody,
} from "./jev/domain/jev-response.ts";
export type {
  ParsedChoiceAnswer,
  ParsedNoulAnswer,
} from "./jev/domain/jev-response.ts";
export {
  COMPLIANT_AT_OR_BELOW,
  InvalidNoulValueError,
  MAXIMUM_AI_CONFIDENCE,
  toNoulVerdict,
  VIOLATION_AT_OR_ABOVE,
} from "./jev/domain/noul-verdict.ts";
export type { NoulVerdict } from "./jev/domain/noul-verdict.ts";
export {
  HttpJevClient,
  type FetchFn,
  type FetchRequestInit,
  type FetchResponseLike,
} from "./jev/infrastructure/http-jev-client.ts";
export { InMemoryJevClient } from "./jev/infrastructure/in-memory-jev-client.ts";
export type {
  ScriptedChoiceJudgment,
  ScriptedNoulJudgment,
} from "./jev/infrastructure/in-memory-jev-client.ts";
export { JEV_SRP_RULE_ID, JevSrpRule } from "./principles/srp/infrastructure/jev-srp-rule.ts";

// Analyze a single source file on the web (#34).
export {
  AnalysisRunProjection,
  INITIAL_ANALYSIS_RUN_VIEW,
} from "./engine/application/analysis-run.projection.ts";
export type {
  AnalysisRunStatus,
  AnalysisRunView,
  CompletedRuleOutcome,
  FailedRuleOutcome,
  RuleOutcomeView,
} from "./engine/application/analysis-run.projection.ts";
