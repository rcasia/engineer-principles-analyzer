# ADR-0010: Publish the CLI to npm with OIDC trusted publishing

**Status**: Accepted
**Date**: 2026-09-19

## Context

ADR-0008 wired up publishing the CLI to npm behind the `NPM_PUBLISH` switch,
authenticated with a long-lived `NPM_TOKEN`. Its Risks and mitigations
section flagged that token as the odd one out: every other credential in
this repository is short-lived OIDC (AWS via ADR-0007's deploy role, GitHub
via the default `GITHUB_TOKEN`), and said moving npm to OIDC was a follow-up.

npm now supports that follow-up directly: [trusted
publishing](https://docs.npmjs.com/trusted-publishers) lets a GitHub Actions
workflow exchange its OIDC identity token for a short-lived npm publish
credential, with no stored secret at all. It requires npm CLI >= 11.5.1 and
Node >= 22.14.0, and needs `permissions: id-token: write` on the job that
publishes.

The catch: npm cannot register a trusted publisher for a package that does
not exist on the registry yet. `principled` has never been published — the
name is still unclaimed (see AGENTS.md's Known gaps) — so there is a
chicken-and-egg step that has to happen once, by a human, outside CI, before
OIDC can take over.

## Decision Drivers

- **No long-lived secret should outlive its usefulness.** Once OIDC is
  registered, `NPM_TOKEN` should be revocable.
- **The bootstrap step is manual and rare; the steady state should not be.**
  Every release after the first should need no secret at all.
- **The publish path must keep working during the transition**, not just
  after it. `NPM_TOKEN` being unset must not be a hard failure.

## Considered Options

### Option A: Switch to OIDC only, drop the token immediately

- **Pros**: simplest script; no token to leak, rotate or forget about.
- **Cons**: cannot work for the very first publish, because no trusted
  publisher can exist yet for a package that has never been published.
  Would require a separate, undocumented bootstrap mechanism anyway.

### Option B: Keep the token as the only mechanism, revisit later

- **Pros**: no change needed.
- **Cons**: leaves the exact risk ADR-0008 already flagged unaddressed, for
  no reason — npm's side of trusted publishing is ready now.

### Option C: Prefer OIDC, keep the token only as a fallback (chosen)

- **Pros**: works unmodified through the bootstrap (no trusted publisher
  registered yet → OIDC exchange is skipped → npm's own fallback to the
  token kicks in) and after it (trusted publisher registered → OIDC is
  used, and the token secret can be deleted from the repository entirely).
  No code branches on which stage the repository is in — npm's CLI decides.
- **Cons**: `NPM_TOKEN` still exists as a supported code path indefinitely,
  even though the goal is to stop relying on it day to day. A stale token
  left in the secrets store after OIDC is working is a mild, easily-audited
  risk (it is scoped to one package and it is deleted below).

## Decision

Publishing prefers **OIDC trusted publishing** and falls back to
**`NPM_TOKEN`** only when OIDC is unavailable or unconfigured. This matches
npm's own documented behaviour ("the npm CLI automatically detects OIDC
environments and uses them for authentication before falling back to
traditional tokens"), so `scripts/publish-cli.ts` does not need to know
which stage the repository is in — it always tries `npm publish`, and only
constructs a token-based `.npmrc` when `NPM_TOKEN` is set, as a safety net
rather than a requirement.

The release workflow already granted `id-token: write` to the release job
(for npm provenance, per ADR-0008); that permission is what OIDC needs. Node
22 on `ubuntu-latest` bundles npm ~10.9.x, below the 11.5.1 floor trusted
publishing requires, so the workflow now runs `npm install -g npm@^11.5.1`
before the release step.

### The one-time bootstrap

1. With `NPM_TOKEN` set and `NPM_PUBLISH=true`, the next release publishes
   `principled` for the first time, authenticated with the token (OIDC has
   nothing to attach to yet).
2. A maintainer registers a trusted publisher on npmjs.com — package
   `principled` → Settings → Trusted publishing → GitHub Actions → repository
   `rcasia/principled`, workflow file `main.yml` (the
   release job lives directly in that file, not behind `workflow_call`) —
   and, per npm's migration guidance, sets "Require two-factor authentication
   and disallow tokens" once it is verified to work.
3. `NPM_TOKEN` is deleted from the repository's secrets. Every release after
   this one authenticates with OIDC alone; nothing in the workflow or script
   needs to change for that to happen.

## Consequences

### Positive

- Steady-state publishing needs no long-lived npm credential, matching AWS
  and GitHub already.
- npm also generates and publishes provenance attestations automatically
  for OIDC publishes from a public repository, at no extra configuration —
  `packages/cli/package.json`'s existing `publishConfig.provenance: true`
  keeps that explicit and keeps working during the bootstrap window too.
- The transition needs no flag day: the same code path serves the bootstrap
  publish and every publish after it.

### Negative

- The bootstrap step (registering the trusted publisher) is manual and can
  only happen after the first publish, so it cannot be exercised by CI. It
  is a one-time, human-run step, documented here rather than automated.
- `NPM_TOKEN` remains a supported fallback in the script indefinitely, not
  removed by this decision — only made non-load-bearing once step 2 above
  is done and the secret is deleted.

### Risks and mitigations

- *Risk*: `NPM_TOKEN` is deleted before the trusted publisher is actually
  registered and working, breaking releases.
  *Mitigation*: verify the first OIDC-only publish succeeds (a release with
  `NPM_TOKEN` still present but unused would already prove this, since npm
  tries OIDC first) before deleting the secret.
- *Risk*: the workflow filename recorded on npmjs.com drifts from reality if
  `main.yml` is ever renamed or the release step moves behind
  `workflow_call`. npm validates against the *calling* workflow's name in
  that case, not the one that runs `npm publish`.
  *Mitigation*: keep the release job directly in `main.yml`, as it is today;
  if that ever changes, update the trusted publisher configuration in the
  same commit.
- *Risk*: `npm install -g npm@^11.5.1` pulls an untested npm version on some
  future run.
  *Mitigation*: the `cli-package` gate already installs and runs the
  published tarball on every push using the npm version `setup-node`
  provides, so a broken npm release would fail CI before reaching the
  release job — though that gate does not itself invoke `npm publish`.
