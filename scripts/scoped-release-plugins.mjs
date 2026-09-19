/**
 * Lets the CLI and web release trains share one commit history without
 * sharing a version: each train only "sees" the commits that actually
 * changed its own package when deciding whether to release and what the
 * release notes say.
 *
 * Wraps @semantic-release/commit-analyzer and
 * @semantic-release/release-notes-generator with a filter based on the
 * files each commit actually touched (via `git diff-tree`), not the
 * commit's message. A commit message scope is a claim a human or agent
 * makes about a commit; the changed files are what's actually true. See
 * ADR-0019 for why this replaced the earlier, message-scope-based filter,
 * and ADR-0016 for why the trains are split at all.
 */
import { execFileSync } from "node:child_process";
import { analyzeCommits as analyzeCommitsWith } from "@semantic-release/commit-analyzer";
import { generateNotes as generateNotesWith } from "@semantic-release/release-notes-generator";

// Paths that belong exclusively to one package - including the ones
// outside packages/* that are, in practice, only ever about one of them.
// scripts/ mixes both (build-cli.ts next to build-lambda.ts), so its
// exclusively-one-side files are listed individually rather than by
// directory; a new script defaults to neither list, i.e. cross-cutting,
// until someone adds it here. docs/design/ is the web app's design system
// wholesale; there is no CLI equivalent. packages/core/ is deliberately
// absent from both: it's bundled into the CLI and called directly by the
// web adapter, so a commit that touches it is never "exclusively" cli or
// web - it counts toward both trains. Anything else outside these lists
// (root config, docs/adr/, .github/) is genuinely cross-cutting for the
// same reason.
export const CLI_PATHS = [
  "packages/cli/",
  "scripts/build-cli.ts",
  "scripts/check-cli-package.ts",
  "scripts/publish-cli.ts",
  "scripts/release-cli.ts",
];
export const WEB_PATHS = [
  "packages/web/",
  "packages/edge-signer/",
  "infra/",
  "docs/design/",
  "scripts/build-lambda.ts",
  "scripts/build-edge-signer.ts",
  "scripts/check-deployed.ts",
  "scripts/release-web.ts",
  "scripts/smoke-lambda.mjs",
  "scripts/tf-local.ts",
];
// Shared by both trains: bundled into the CLI and called directly by the
// web adapter, so a commit touching it counts toward both.
export const CORE_PATHS = ["packages/core/"];

function touchedFiles(hash, cwd) {
  // --root: shows the files touched by the very first commit too, which
  // otherwise diffs against nothing and reports no files. Merge commits
  // report no files either way (diff-tree doesn't diff merges by default,
  // and re-running with -m or -c would attribute every file the merge
  // brought in to this filter, which is not what an ordinary trunk-based
  // history full of no-merge commits needs). Either way, an empty file
  // list falls through as "cross-cutting" below - counted by every train,
  // rather than silently excluded from all of them.
  const output = execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", hash], {
    cwd,
    encoding: "utf8",
  });
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function touchesAny(files, prefixes) {
  return files.some((file) => prefixes.some((prefix) => file.startsWith(prefix)));
}

// A commit belongs to a train when it touched that train's files or core.
// A commit touching only the other train's files is excluded. Anything
// else - only cross-cutting files (root config, docs/adr/, .github/), or
// no files at all (merges) - counts toward both trains, matching the old
// scope filter's treatment of unscoped and cross-cutting scopes.
//
// Checking own-side first matters: a commit mixing CLI files with
// cross-cutting docs/CI config is still a CLI commit, not a both-trains
// commit. The incidental README or workflow touch doesn't drag the other
// train in.
function belongsToTrain(commit, cwd, ownPaths, otherPaths) {
  const files = touchedFiles(commit.hash, cwd);
  if (files.length === 0) {
    return true;
  }
  if (touchesAny(files, CORE_PATHS)) {
    return true;
  }
  if (touchesAny(files, ownPaths)) {
    return true;
  }
  if (touchesAny(files, otherPaths)) {
    return false;
  }
  return true;
}

function filterCommits(context, ownPaths, otherPaths) {
  return {
    ...context,
    commits: context.commits.filter((commit) => belongsToTrain(commit, context.cwd, ownPaths, otherPaths)),
  };
}

// The releaseRules both trains use to decide *whether* a commit that
// belongs to them releases. Identical on purpose: once a commit belongs to
// a train, it should be judged the same way regardless of which train that
// is.
export const RELEASE_RULES = [
  { type: "docs", scope: "adr", release: "patch" },
  { type: "refactor", release: "patch" },
  { type: "perf", release: "patch" },
  { type: "ci", release: false },
  { type: "chore", release: false },
];

/**
 * @param {string[]} ownPaths Path prefixes belonging to *this* train, e.g.
 *   `CLI_PATHS` for the CLI train.
 * @param {string[]} otherPaths Path prefixes belonging to the *other*
 *   train, e.g. `WEB_PATHS` for the CLI train.
 * @returns {{analyzeCommits: Function}} An inline semantic-release plugin.
 */
export function scopedCommitAnalyzer(ownPaths, otherPaths) {
  return {
    analyzeCommits: (pluginConfig, context) =>
      analyzeCommitsWith(pluginConfig, filterCommits(context, ownPaths, otherPaths)),
  };
}

/**
 * @param {string[]} ownPaths Path prefixes belonging to *this* train.
 * @param {string[]} otherPaths Path prefixes belonging to the *other*
 *   train. See {@link scopedCommitAnalyzer}.
 * @returns {{generateNotes: Function}} An inline semantic-release plugin.
 */
export function scopedReleaseNotesGenerator(ownPaths, otherPaths) {
  return {
    generateNotes: (pluginConfig, context) =>
      generateNotesWith(pluginConfig, filterCommits(context, ownPaths, otherPaths)),
  };
}
