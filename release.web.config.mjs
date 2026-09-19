/**
 * semantic-release configuration for the web release train.
 *
 * This is one of two independent trains - see release.cli.config.mjs for
 * the other - so that a CLI-only change cannot bump the web app's version,
 * and vice versa. A commit only counts toward this train if it changed
 * touched its files or core - core changes count toward both. See
 * scripts/scoped-release-plugins.mjs and ADR-0019.
 *
 * The web app is not published to a registry, so there is no equivalent of
 * the CLI's NPM_PUBLISH switch or publishCmd here: `prepareCmd` writes the
 * version and verifies the Lambda bundle still builds, and the `deploy` job
 * in .github/workflows/main.yml - which runs after this train, unconditional
 * on whether it actually cut a release - is what ships the result to AWS.
 */
import {
  CLI_PATHS,
  RELEASE_RULES,
  scopedCommitAnalyzer,
  scopedReleaseNotesGenerator,
  WEB_PATHS,
} from "./scripts/scoped-release-plugins.mjs";

const WEB_PACKAGE = "packages/web";

export default {
  branches: ["main"],
  tagFormat: "web-v${version}",
  plugins: [
    [scopedCommitAnalyzer(WEB_PATHS, CLI_PATHS), { releaseRules: RELEASE_RULES }],
    scopedReleaseNotesGenerator(WEB_PATHS, CLI_PATHS),
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
