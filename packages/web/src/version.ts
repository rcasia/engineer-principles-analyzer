/**
 * Replaced by scripts/build-lambda.ts when bundling for deploy, so the
 * served pages report the released web version. Running from source reports
 * `dev`, which is honest: a source checkout has no release number.
 *
 * The build fails loudly if this literal is not found, so the two cannot
 * drift apart silently.
 */
export const VERSION = "0.0.0-dev";
