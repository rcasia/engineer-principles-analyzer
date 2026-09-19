# ADR-0007: Keep production state in S3, provisioned by a bootstrap module

**Status**: Accepted
**Date**: 2026-09-19

## Context

ADR-0005 left Terraform state local, noting a remote backend would be needed
"before more than one actor deploys". That understated the problem.

CI runners are ephemeral. With local state, the `deploy` job starts every run
with an empty state file, concludes nothing exists, and tries to create the
whole stack. The first production deploy would succeed and **every subsequent
deploy would fail** with `EntityAlreadyExists` on the IAM role. Not a gradual
degradation — a hard failure on run two.

So this is a prerequisite for turning deployment on at all, not an
improvement to make later.

## Decision Drivers

- **State must outlive the runner**, or continuous deployment cannot work.
- **Concurrent applies must not corrupt it.** `main.yml` serialises deploys,
  but a human running `apply` locally does not know that.
- **Low cost by design.** The state backend must not add a billed resource.
- **The LocalStack gate must keep working** with no credentials (ADR-0005).

## Considered Options

### Where state lives

**Option A: S3 with native locking (`use_lockfile = true`).** Terraform 1.10+
implements locking with a conditional-write lock object in the same bucket.
Costs fractions of a cent.

**Option B: S3 plus a DynamoDB lock table.** The pattern most documentation
still describes. Correct, but an extra resource to provision, monitor and pay
for, and obsolete since 1.10.

**Option C: Terraform Cloud / HCP.** Free tier, good UX, remote runs.
Rejected: another account and another vendor, for state we can keep in a
bucket we already need.

### How the bucket gets created

**Option A: A separate `infra/bootstrap` module, run once by a human.**
Explicit, reviewable, and the same Terraform as everything else.

**Option B: A documented `aws s3api create-bucket` command.** Fewer files,
but the bucket's versioning, encryption and public-access settings then live
in a README rather than in code, and drift silently.

**Option C: Auto-create from the pipeline.** Requires the pipeline to hold
credentials able to create its own trust relationship. Rejected outright.

### How LocalStack avoids the remote backend

A declared `backend "s3" {}` breaks local runs: `terraform apply` after
`init -backend=false` fails with "Backend initialization required". Verified,
not assumed.

**Option A: A generated `backend_override.tf` selecting the local backend.**
Terraform merges `*_override.tf` files and they are already gitignored, so it
cannot leak into a commit.

**Option B: Point the S3 backend at LocalStack's own S3.** Symmetrical, but
needs endpoint overrides in backend config and a bucket created before init —
reintroducing the bootstrap problem locally, for no benefit.

**Option C: Two root modules.** Duplicates the infrastructure definition,
which is precisely what ADR-0005 avoided.

## Decision

Production state lives in **S3 with native locking**, configured as a
**partial backend**: `backend.prod.hcl` holds the invariant settings, and the
bucket and region come from the `TF_STATE_BUCKET` and `AWS_REGION` repository
variables at `init` time.

The bucket, the GitHub OIDC provider and the deploy role are created by
**`infra/bootstrap`**, applied once by a human. Its own state is local and
gitignored; if lost, the three resources are re-imported rather than
re-created, which its README documents.

LocalStack runs go through **`scripts/tf-local.ts`**, which writes a
`backend_override.tf` selecting the local backend before running Terraform.
Only the state location differs; the infrastructure is the same configuration
in both cases.

The deploy role is scoped to `repo:<owner>/<repo>:environment:production` —
the **environment**, not a branch — so obtaining credentials requires a job
that declares `environment: production`, which GitHub protection rules gate.

## Consequences

### Positive

- Deploys are repeatable. The second deploy updates rather than collides.
- Concurrent applies are blocked by the lock object, including a local
  `apply` racing CI.
- No DynamoDB table, so the cost story in ADR-0005 is unchanged.
- The whole credential boundary is one reviewable module, and a human uses
  AWS credentials exactly once, to run it.

### Negative

- A new contributor cannot deploy to production without the bootstrap having
  been run; there is a manual step before the automation works.
- `infra/bootstrap` state is local, so it is not reproducible from a clone.
  Mitigated by documented imports, not solved.
- Local runs now depend on a generated override file. `terraform apply` typed
  by hand in `infra/` will target the **production** backend, which is a
  sharper edge than before. `scripts/tf-local.ts` exists so nobody needs to.
- `backend.prod.hcl` hardcodes `key = "prod/terraform.tfstate"`, so a second
  environment needs a second file.

### Risks and mitigations

- *Risk*: Someone runs `terraform apply` directly in `infra/` and hits
  production. *Mitigation*: the documented path is `bun run infra:apply:local`
  everywhere; production applies happen in CI under an assumed role that a
  developer's shell does not have.
- *Risk*: The state bucket is deleted. *Mitigation*: `prevent_destroy = true`
  plus versioning; removing it is a deliberate two-step.
- *Risk*: The deploy role can write IAM roles named `epa-*` with no review.
  *Mitigation*: bounded by the name prefix, and a required reviewer can be
  added to the `production` environment. Stated plainly in the bootstrap
  README rather than buried.
