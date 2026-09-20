/**
 * Sensitive-data baseline for telemetry, logs and analytics (#28).
 *
 * Submitted source code is customer content and potentially sensitive data.
 * These helpers are the executable form of three #28 rules:
 *
 * - The CLI and the core engine emit no telemetry by default; only an
 *   explicit opt-in turns collection on.
 * - Application logs, analytics events and persisted event payloads must
 *   never carry source code, prompts, findings, credentials, cookies,
 *   authorization headers or request bodies.
 * - The same forbidden-key scan guards every new measurement slice
 *   (#30 evaluation snapshots, #31 web metrics, #32 public exemplars), so a
 *   future metric cannot silently start retaining what #28 forbids.
 *
 * Pure domain module: no I/O, no imports outside this file.
 */

/** Telemetry is off unless the caller explicitly opts in. */
export const TELEMETRY_ENABLED_BY_DEFAULT = false;

/**
 * Resolves whether telemetry collection is allowed. Only an explicit `true`
 * enables it — `undefined` and `false` both stay off, so a missing flag can
 * never become consent.
 */
export function resolveTelemetryOptIn(optIn: boolean | undefined): boolean {
  return optIn === true;
}

/**
 * Payload keys that must never reach logs, analytics events or persisted
 * event payloads. Matched case-insensitively against every key of a scanned
 * value, at any nesting depth.
 */
export const FORBIDDEN_TELEMETRY_KEYS: readonly string[] = [
  "sourceCode",
  "prompt",
  "finding",
  "findings",
  "evidence",
  "explanation",
  "remediation",
  "repository",
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "credential",
  "apiKey",
  "email",
];

export class TelemetryContainsSensitiveDataError extends Error {
  override readonly name = "TelemetryContainsSensitiveDataError";

  constructor(readonly keys: readonly string[]) {
    super(
      `Telemetry payload contains forbidden keys: ${keys.join(", ")}.`,
    );
  }
}

function normalizedKeyOf(key: string): string {
  return key.toLowerCase();
}

function forbiddenMatchOf(key: string): string | undefined {
  const normalized = normalizedKeyOf(key);
  return FORBIDDEN_TELEMETRY_KEYS.find(
    (forbidden) => forbidden.toLowerCase() === normalized,
  );
}

/**
 * Lists the forbidden keys present anywhere in `value`, in first-seen order
 * with no duplicates. Plain objects are scanned by key and arrays element by
 * element; primitives contribute nothing. Cyclic values terminate instead of
 * recursing forever.
 */
export function findForbiddenKeys(value: unknown): readonly string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();

  function scan(current: unknown): void {
    if (current === null || typeof current !== "object") {
      return;
    }

    if (seen.has(current)) {
      return;
    }

    seen.add(current);

    // `Object.entries` yields index keys for arrays, so this one loop scans
    // plain objects by key and arrays element by element with no special
    // case: indices never match a forbidden key, and every element is
    // still visited below.
    for (const [key, child] of Object.entries(current)) {
      const match = forbiddenMatchOf(key);

      if (match !== undefined && !found.includes(match)) {
        found.push(match);
      }

      scan(child);
    }
  }

  scan(value);

  return found;
}

/**
 * Throws {@link TelemetryContainsSensitiveDataError} when `value` carries
 * any forbidden key. Call this where a measurement leaves the domain — log
 * lines, analytics events, snapshot publication — so a violation fails fast
 * instead of being persisted.
 */
export function assertTelemetrySafe(value: unknown): void {
  const keys = findForbiddenKeys(value);

  if (keys.length > 0) {
    throw new TelemetryContainsSensitiveDataError([...keys]);
  }
}
