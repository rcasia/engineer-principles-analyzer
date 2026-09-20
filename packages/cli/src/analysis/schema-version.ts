/**
 * Version of the CLI's machine-readable analysis schemas (#19, #44).
 *
 * Both `--format json` and `--format sarif` outputs carry this version so
 * scripts and CI workflows can detect a breaking change instead of silently
 * misreading new output. Bump it only with a breaking change to either
 * shape, and document the change alongside.
 */
export const ANALYSIS_OUTPUT_SCHEMA_VERSION = "1";
