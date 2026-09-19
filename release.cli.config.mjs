/**
 * semantic-release configuration for the CLI release train.
 *
 * This is one of two independent trains - see release.web.config.mjs for
 * the other - so that a web-only change cannot bump the CLI's version, and
 * vice versa. Only commits scoped "cli" or "core" (core is bundled into the
 * published tarball) count toward this train; see
 * scripts/scoped-release-plugins.mjs and ADR-0016.
 *
 * npm publishing is switched on by the NPM_PUBLISH environment variable, the
 * same way deployment is switched on by AWS_DEPLOY_ROLE_ARN. Until it is
 * "true" the CLI version is still bumped and committed and the tarball is
 * still built and verified, so the wiring is exercised on every release - it
 * is just not uploaded.
 *
 * See docs/adr/0008-publish-the-cli-to-npm.md
 */
import {
  RELEASE_RULES,
  scopedCommitAnalyzer,
  scopedReleaseNotesGenerator,
} from "./scripts/scoped-release-plugins.mjs";

const CLI_PACKAGE = "packages/cli";
const CLI_SCOPES = ["cli", "core"];

export default {
  branches: ["main"],
  plugins: [
    [scopedCommitAnalyzer(CLI_SCOPES), { releaseRules: RELEASE_RULES }],
    scopedReleaseNotesGenerator(CLI_SCOPES),
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
