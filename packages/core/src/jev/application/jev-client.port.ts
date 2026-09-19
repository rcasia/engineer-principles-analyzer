/**
 * Driven port: the Jev boundary of the hexagon.
 *
 * The domain never touches the network. This interface is the only thing the
 * rule adapters (`JevSrpRule`) see; the HTTP adapter and the in-memory
 * adapter both implement it, so tests and offline validation exercise the
 * same port production uses.
 *
 * v1 asks a single Noul question per subject ("whether a condition holds" —
 * the TypeSafe skill's guidance for binary judgments). Independent questions
 * asked together is a later extension of this port, not a second port.
 */
export interface NoulQuestion {
  readonly instructions: string;
  readonly criteria?: {
    readonly true?: string;
    readonly false?: string;
  };
}

export interface NoulJudgment {
  /** Calibrated probability that the answer is yes, in `[0, 1]`. */
  readonly value: number;
  /**
   * Model that answered, e.g. `"jev-1.13.0"`. Recorded in
   * `evaluationMetadata` (#30) so snapshots attribute results to the exact
   * implementation — never trusted, always verified.
   */
  readonly model: string;
}

/**
 * The network, the service, or the wire shape failed. Deliberately carries
 * no response body, no request state and no credential: the engine persists
 * failure reasons in `AnalysisFailed` events (#33 "Sensitive data"), so
 * anything echoed here would become stored data.
 */
export class JevTransportError extends Error {
  override readonly name = "JevTransportError";
}

export interface JevClient {
  evaluateNoul(input: {
    readonly state: unknown;
    readonly question: NoulQuestion;
  }): Promise<NoulJudgment>;
}
