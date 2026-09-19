/**
 * semantic-release configuration.
 *
 * This is JavaScript rather than JSON for one reason: npm publishing is
 * switched on by an environment variable, the same way deployment is switched
 * on by AWS_DEPLOY_ROLE_ARN. Until NPM_PUBLISH is "true" the CLI version is
 * still bumped and committed, so the wiring is exercised on every release -
 * it is just not published.
 *
 * See docs/adr/0008-publish-the-cli-to-npm.md
 */
const npmPublish = process.env.NPM_PUBLISH === "true";

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
    // Writes the release version into packages/cli/package.json. With
    // npmPublish false it stops there and publishes nothing.
    ["@semantic-release/npm", { pkgRoot: CLI_PACKAGE, npmPublish }],
    // Runs after the version has been written, so the bundle is stamped with
    // the released version rather than the previous one.
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun scripts/build-cli.ts && bun scripts/check-cli-package.ts",
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
