import {
  buildNoulRequestBody,
  JEV_ENDPOINT,
  JEV_MODEL,
  JEV_NOUL_QUESTION_ID,
} from "../domain/jev-request.ts";
import { parseNoulAnswerBody } from "../domain/jev-response.ts";
import {
  JevTransportError,
  type JevClient,
  type NoulJudgment,
  type NoulQuestion,
} from "../application/jev-client.port.ts";

/** Minimal structural shape of `fetch`, so core takes no HTTP dependency (ADR-0008). */
export interface FetchRequestInit {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init: FetchRequestInit,
) => Promise<FetchResponseLike>;

/**
 * Driven adapter: calls the TypeSafe SystemOne endpoint with an injected
 * `fetch` and key. Dependency-free — `fetch` is provided by the composition
 * root (Node 20+ and Bun both ship it), so `@principled/core` still has no
 * runtime dependencies and the `principled` bundle stays self-contained.
 *
 * The key travels in one place only (the `Authorization` header) and never
 * appears in an error: failure reasons reach `AnalysisFailed` events, which
 * may be persisted.
 */
export class HttpJevClient implements JevClient {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;
  private readonly endpoint: string;
  private readonly model: string;

  constructor(options: {
    readonly apiKey: string;
    readonly fetchFn: FetchFn;
    readonly endpoint?: string;
    readonly model?: string;
  }) {
    if (options.apiKey.trim().length === 0) {
      throw new Error("HttpJevClient requires a non-empty apiKey.");
    }

    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn;
    this.endpoint = options.endpoint ?? JEV_ENDPOINT;
    this.model = options.model ?? JEV_MODEL;
  }

  async evaluateNoul(input: {
    readonly state: unknown;
    readonly question: NoulQuestion;
  }): Promise<NoulJudgment> {
    const body = JSON.stringify(
      buildNoulRequestBody(
        input.state,
        this.model,
        JEV_NOUL_QUESTION_ID,
        input.question,
      ),
    );

    let response: FetchResponseLike;
    try {
      response = await this.fetchFn(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (error) {
      throw new JevTransportError(`Jev request failed: ${messageOf(error)}`);
    }

    if (!response.ok) {
      throw new JevTransportError(
        `Jev request failed with status ${response.status}.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new JevTransportError(
        "Jev returned a response that could not be parsed.",
      );
    }

    const answer = parseNoulAnswerBody(parsed, JEV_NOUL_QUESTION_ID);
    if (!answer.ok) {
      throw answer.error;
    }

    return answer.value;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
