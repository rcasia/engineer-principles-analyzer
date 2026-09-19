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
