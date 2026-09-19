import type { EventEnvelope } from "./event.ts";

/**
 * Reconstruct state by folding an ordered history through `evolve`.
 *
 * This is the whole of aggregate rehydration: no mutable current-state record
 * is the source of truth, only the events (ADR-0012). An empty history yields
 * the initial state unchanged.
 */
export function rehydrate<TState, TEvent>(
  initialState: TState,
  history: readonly TEvent[],
  evolve: (state: TState, event: TEvent) => TState,
): TState {
  return history.reduce(evolve, initialState);
}

/**
 * Reconstruct state as it was at a sequence boundary, inclusive.
 *
 * Folding only the events up to and including `sequence` yields the exact
 * historical state at that point, which is what bug reproduction and
 * time-travel queries need (ADR-0012, "State reconstruction").
 */
export function rehydrateAt<TState, TPayload>(
  initialState: TState,
  history: readonly EventEnvelope<TPayload>[],
  evolve: (state: TState, event: EventEnvelope<TPayload>) => TState,
  sequence: number,
): TState {
  return rehydrate(
    initialState,
    history.filter((event) => event.sequence <= sequence),
    evolve,
  );
}
