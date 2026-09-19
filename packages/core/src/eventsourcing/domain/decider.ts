/**
 * The pure heart of an event-sourced aggregate (ADR-0012, "Command side").
 *
 * A decider knows nothing about storage. `decide` turns a command and the
 * current state into the events that should follow, enforcing invariants;
 * `evolve` folds a single event into state. Both are pure, so an aggregate
 * is reconstructed by replaying its history through `evolve` and a command
 * is handled without touching any I/O.
 *
 * Deciders are the shape #34 (analyze a single source file) will implement;
 * this package provides the type and the folding helpers, not the rules.
 */
export interface Decider<TState, TCommand, TEvent> {
  /** State of an aggregate whose stream is empty. */
  readonly initialState: TState;
  /** Decide which events a command produces, or reject it by throwing. */
  decide(command: TCommand, state: TState): readonly TEvent[];
  /** Fold a single event into state. Must be deterministic. */
  evolve(state: TState, event: TEvent): TState;
}
