/**
 * semantic-release configuration.
 *
 * npm publishing is switched on by the NPM_PUBLISH environment variable, the
 * same way deployment is switched on by AWS_DEPLOY_ROLE_ARN. Until it is
 * "true" the CLI version is still bumped and committed and the tarball is
 * still built and verified, so the wiring is exercised on every release - it
 * is just not uploaded.
 *
 * See docs/adr/0008-publish-the-cli-to-npm.md
 */
const CLI_PACKAGE = "packages/cli";

export default {
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        releaseRules: [
          { type: "docs", scope: "adr", release: "patch" },
          { type: "refactor", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "ci", release: false },
          { type: "chore", release: false },
        ],
      },
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    // @semantic-release/npm is deliberately not used: it shells out to
    // `npm version`, which reifies the whole workspace tree and fails on any
    // dependency with a non-npm range. Stryker's transitive dependencies ship
    // "catalog:", so that command can never succeed here. These scripts write
    // the version, build the bundle and verify the tarball instead.
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun scripts/release-cli.ts ${nextRelease.version}",
        publishCmd: "bun scripts/publish-cli.ts",
      },
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", `${CLI_PACKAGE}/package.json`],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
