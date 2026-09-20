/**
 * Pure builder for the TypeSafe SystemOne evaluation request body
 * (`POST /v1/systemone`). Lives in `domain/` so the wire shape is
 * constructed — and tested — with no I/O involved: the HTTP adapter only
 * sends what this function returns.
 *
 * Field meanings follow https://docs.typesafe.ai/api: `state` is the content
 * under judgment, `model` selects the System One model, and each entry of
 * `questions` is one typed question whose answer comes back under the same
 * id. Question ids are for code only and are never sent to the model.
 */
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** Model alias resolving to the current Jev release (see docs.typesafe.ai/models). */
export const JEV_MODEL = "jev-latest";

/** Wire id of the single Noul question v1 asks. */
export const JEV_NOUL_QUESTION_ID = "noul";

/** Wire id of the single Choice question v1 asks. */
export const JEV_CHOICE_QUESTION_ID = "choice";

export interface NoulQuestionShape {
  readonly instructions: string;
  readonly criteria?: {
    readonly true?: string;
    readonly false?: string;
  };
}

export interface JevNoulRequestBody {
  readonly state: unknown;
  readonly model: string;
  readonly questions: {
    readonly [questionId: string]: {
      readonly type: "noul";
      readonly instructions: string;
      readonly criteria?: {
        readonly true?: string;
        readonly false?: string;
      };
    };
  };
}

export function buildNoulRequestBody(
  state: unknown,
  model: string,
  questionId: string,
  question: NoulQuestionShape,
): JevNoulRequestBody {
  return {
    state,
    model,
    questions: {
      [questionId]: { type: "noul" as const, ...question },
    },
  };
}

export interface ChoiceQuestionShape {
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string | null>>;
}

export interface JevChoiceRequestBody {
  readonly state: unknown;
  readonly model: string;
  readonly questions: {
    readonly [questionId: string]: {
      readonly type: "choice";
      readonly instructions: string;
      readonly criteria: Readonly<Record<string, string | null>>;
    };
  };
}

export function buildChoiceRequestBody(
  state: unknown,
  model: string,
  questionId: string,
  question: ChoiceQuestionShape,
): JevChoiceRequestBody {
  return {
    state,
    model,
    questions: {
      [questionId]: { type: "choice" as const, ...question },
    },
  };
}
