/**
 * semantic-release configuration for the web release train.
 *
 * This is one of two independent trains - see release.cli.config.mjs for
 * the other - so that a CLI-only change cannot bump the web app's version,
 * and vice versa. Only commits scoped "web", "infra" or "core" (core is the
 * domain layer the web adapter calls into) count toward this train; see
 * scripts/scoped-release-plugins.mjs and ADR-0016.
 *
 * The web app is not published to a registry, so there is no equivalent of
 * the CLI's NPM_PUBLISH switch or publishCmd here: `prepareCmd` writes the
 * version and verifies the Lambda bundle still builds, and the `deploy` job
 * in .github/workflows/main.yml - which runs after this train, unconditional
 * on whether it actually cut a release - is what ships the result to AWS.
 */
import {
  RELEASE_RULES,
  scopedCommitAnalyzer,
  scopedReleaseNotesGenerator,
} from "./scripts/scoped-release-plugins.mjs";

const WEB_PACKAGE = "packages/web";
const WEB_SCOPES = ["web", "infra", "core"];

export default {
  branches: ["main"],
  tagFormat: "web-v${version}",
  plugins: [
    [scopedCommitAnalyzer(WEB_SCOPES), { releaseRules: RELEASE_RULES }],
    scopedReleaseNotesGenerator(WEB_SCOPES),
    [
      "@semantic-release/changelog",
      {
        changelogFile: `${WEB_PACKAGE}/CHANGELOG.md`,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun scripts/release-web.ts ${nextRelease.version}",
      },
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: [`${WEB_PACKAGE}/CHANGELOG.md`, `${WEB_PACKAGE}/package.json`],
        message:
          "chore(release): web-v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
