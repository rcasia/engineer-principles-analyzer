/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scopes map to workspace packages plus the cross-cutting concerns.
    "scope-enum": [
      2,
      "always",
      ["core", "cli", "web", "infra", "ci", "deps", "adr", "release"],
    ],
    // Atomic commits: a subject that does not fit here is more than one commit.
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};
