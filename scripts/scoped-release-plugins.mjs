/**
 * Lets the CLI and web release trains share one commit history without
 * sharing a version: each train only "sees" the commits scoped to its own
 * package when deciding whether to release and what the release notes say.
 *
 * Wraps @semantic-release/commit-analyzer and
 * @semantic-release/release-notes-generator rather than depending on a
 * monorepo-aware semantic-release plugin (e.g. semantic-release-monorepo):
 * those filter by which files a commit touched, which needs a git diff per
 * commit; this repository already requires a commitlint scope on every
 * commit that names the affected package, so filtering on that is cheaper,
 * has no extra dependency, and matches how the CLI's `prepareCmd`/
 * `publishCmd` already replace official plugins with small local scripts
 * (see ADR-0008). See ADR-0016 for why the trains are split at all.
 */
import { analyzeCommits as analyzeCommitsWith } from "@semantic-release/commit-analyzer";
import { generateNotes as generateNotesWith } from "@semantic-release/release-notes-generator";

// commitlint.config.mjs enumerates these as the allowed commit scopes. The
// ones below name one specific workspace package; every other allowed scope
// (ci, deps, adr, release) - and no scope at all - is cross-cutting and
// therefore relevant to every release train.
const PACKAGE_SCOPES = ["cli", "web", "core", "infra"];

// The releaseRules both trains use to decide *whether* a scoped-in commit
// releases. Identical on purpose: once a commit belongs to a train, it
// should be judged the same way regardless of which train that is.
export const RELEASE_RULES = [
  { type: "docs", scope: "adr", release: "patch" },
  { type: "refactor", release: "patch" },
  { type: "perf", release: "patch" },
  { type: "ci", release: false },
  { type: "chore", release: false },
];

function scopeOf(message) {
  const header = message.split("\n", 1)[0] ?? "";
  const match = /^\w+(?:\(([^)]+)\))?!?:/.exec(header);
  return match ? match[1] : undefined;
}

function belongsToTrain(commit, ownScopes) {
  const scope = scopeOf(commit.message);
  // No scope, or a cross-cutting scope this repo doesn't tie to one package:
  // every train considers it. A scope naming *another* package: excluded.
  return scope === undefined || ownScopes.includes(scope) || !PACKAGE_SCOPES.includes(scope);
}

function filterCommits(context, ownScopes) {
  return { ...context, commits: context.commits.filter((commit) => belongsToTrain(commit, ownScopes)) };
}

/**
 * @param {string[]} ownScopes The commitlint scopes that belong to this
 *   release train, e.g. `["cli", "core"]`.
 * @returns {{analyzeCommits: Function}} An inline semantic-release plugin.
 */
export function scopedCommitAnalyzer(ownScopes) {
  return {
    analyzeCommits: (pluginConfig, context) => analyzeCommitsWith(pluginConfig, filterCommits(context, ownScopes)),
  };
}

/**
 * @param {string[]} ownScopes The commitlint scopes that belong to this
 *   release train, e.g. `["cli", "core"]`.
 * @returns {{generateNotes: Function}} An inline semantic-release plugin.
 */
export function scopedReleaseNotesGenerator(ownScopes) {
  return {
    generateNotes: (pluginConfig, context) => generateNotesWith(pluginConfig, filterCommits(context, ownScopes)),
  };
}
