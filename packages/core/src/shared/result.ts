/**
 * The outcome of an operation that can fail in an expected way.
 *
 * Used throughout the domain instead of throwing: an invalid confidence, an
 * empty rule id or a malformed source location are normal, anticipated
 * outcomes of validating untrusted input (a rule implementation, a CLI flag,
 * a web form) — not exceptional conditions. A caller is forced by the type
 * system to look at `ok` before it can reach `value`, so a validation error
 * cannot be silently skipped the way an uncaught or un-awaited throw can be.
 *
 * Reserve actually throwing for programmer errors and truly unexpected
 * failures (e.g. an invariant a caller could not have anticipated violating
 * through the public API) — not for reporting normal, anticipated validation
 * failures.
 */
export type Result<T, E> = Readonly<Ok<T>> | Readonly<Err<E>>;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export class UnwrapError extends Error {
  override readonly name = "UnwrapError";
}

/**
 * Extracts the value from a successful result, or throws.
 *
 * This is the one place throwing belongs in this module: at a boundary
 * where the caller's own contract already guarantees success (a fixture in
 * a test, a literal known valid at the call site) and a failure there would
 * be a programmer error, not a normal validation outcome. Prefer checking
 * `result.ok` and handling `result.error` as a value everywhere else.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new UnwrapError(
      `Called unwrap on an error result: ${String(result.error)}`,
    );
  }

  return result.value;
}

/**
 * Extracts the error from a failed result, or throws. The mirror of
 * {@link unwrap}, kept to the same rule: only for boundaries where getting
 * a successful result instead would itself be the bug being tested for.
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new UnwrapError("Called unwrapErr on an ok result.");
  }

  return result.error;
}
