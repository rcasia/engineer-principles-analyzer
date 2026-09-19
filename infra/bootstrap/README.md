# Bootstrap

Run this **once per AWS account**, by a human, before the pipeline can deploy
anything. It creates the three things the pipeline cannot create for itself:

| Resource                   | Why it cannot be created by the pipeline               |
| -------------------------- | ------------------------------------------------------ |
| S3 bucket for Terraform state | The main stack stores its state in it, so it must exist first |
| GitHub OIDC provider       | Needed to obtain credentials at all                     |
| `principled-github-deploy` role   | The identity the pipeline assumes                       |

Everything else — the Lambda, its role, its log group, the Function URL — is
created by the pipeline. Nothing here is on the deploy path, so this module
is applied rarely and manually, and that is deliberate.

## Before you start

You need:

- An AWS account and credentials for it with permission to create IAM roles,
  an OIDC provider and an S3 bucket. This is the **only** time a human uses
  AWS credentials directly.
- A globally unique S3 bucket name. Bucket names are global across all AWS
  accounts, so pick something with entropy: `principled-tfstate-a1b2c3`.
- Terraform 1.10 or newer (`use_lockfile` requires it).

## Before you apply: check your OIDC subject format

GitHub started issuing **immutable subject claims** — the `sub` in the OIDC
token references the repository owner and name by their numeric IDs, not
their (renameable) names — as the automatic, non-optional default for every
repository created on or after **2026-07-15**. Repositories created earlier
keep the old name-based format unless they explicitly opt in.

Check which one your repository actually uses:

```sh
gh api repos/OWNER/REPO/actions/oidc/customization/sub
```

If `use_immutable_subject` is `true`, the response includes the exact
`sub_claim_prefix` your trust policy must match — this module builds it from
`github_owner_id` and `github_repo_id`, defaulted for `rcasia/principled`.
**Override both on a fork**, since forking creates a new repository with new
IDs. Look them up with:

```sh
gh api repos/OWNER/REPO -q '.owner.id, .id'
```

If `use_immutable_subject` is `false`, set `github_use_immutable_subject = false`
to use the legacy `repo:owner/repo:environment:name` format instead.

**Getting this wrong does not fail loudly.** AWS returns the same
`Not authorized to perform sts:AssumeRoleWithWebIdentity` for a mismatched
subject as it does for a trust policy that has not yet propagated — except a
mismatch is deterministic and retrying never fixes it. If a deploy fails this
way, re-run it once to rule out propagation delay; if it fails identically a
second time, this is almost certainly the cause. Compare
`terraform output trusted_subject` against the real `sub_claim_prefix` above.

## Steps

### 1. Apply this module

```sh
cd infra/bootstrap

terraform init
terraform apply -var 'state_bucket_name=principled-tfstate-CHANGEME'
```

If the account already has a GitHub OIDC provider — an account can only have
one per URL — add `-var 'create_oidc_provider=false'` and it will reuse the
existing one.

Useful variables:

| Variable              | Default                               | Notes                                    |
| --------------------- | ------------------------------------- | ---------------------------------------- |
| `state_bucket_name`   | _required_                            | Must be globally unique                  |
| `aws_region`          | `eu-west-1`                           | Must match the region used at `init`     |
| `github_repository`   | `rcasia/principled`                   | Change this on a fork                    |
| `github_environment`  | `production`                          | Must match `environment:` in `main.yml`  |
| `create_oidc_provider`| `true`                                | `false` if one already exists            |
| `resource_prefix`     | `principled`                          | What the deploy role may manage          |

### 2. Create the GitHub environment

The trust policy only allows jobs running in a specific **environment**, so
the environment has to exist:

```sh
gh api -X PUT repos/OWNER/REPO/environments/production
```

Add protection rules here if you want a human approval before production.
This is the natural place for it, since there is no pull request review
(ADR-0006).

### 3. Set the repository variables

`terraform output next_steps` prints these with the values filled in:

```sh
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(terraform output -raw deploy_role_arn)"
gh variable set TF_STATE_BUCKET     --body "$(terraform output -raw state_bucket)"
gh variable set AWS_REGION          --body "$(terraform output -raw aws_region)"
```

**Setting `AWS_DEPLOY_ROLE_ARN` is the on-switch.** The `deploy` job in
`.github/workflows/main.yml` is skipped while it is empty, so until this
point the pipeline is green and deploys nothing. The next green commit on
main after you set it will be promoted to production.

### 4. Verify

Push a trivial commit, or re-run the last workflow. The `promote to
production` job should run and finish with `check-deployed.ts` reporting that
the deployed function serves the page.

To check the deploy role independently, without waiting for a commit:

```sh
gh workflow run main.yml   # runs the whole pipeline on main
```

## What the deploy role can do

Scoped to this project, not the account:

- Read and write **only** the state bucket.
- Create, update and delete IAM roles named `principled-*` — required because the
  stack provisions its own Lambda execution role.
- Manage Lambda functions named `principled-*` and their Function URLs.
- Manage log groups under `/aws/lambda/principled-*`.
- `logs:DescribeLogGroups` account-wide, because that call cannot be scoped
  to a single group. It is read only.
- Manage CloudFront distributions and origin access controls. **This is the
  least scoped statement in the policy**: CloudFront ARNs contain a generated
  ID rather than a name, so they cannot be restricted by prefix the way the
  Lambda and IAM statements are. In an account shared with other CloudFront
  distributions, prefer a dedicated account over tightening this.

Be clear about what this means: **a green commit on main can create and
modify IAM roles prefixed `principled-`, with no human review.** That is a
consequence of the trunk-based model in ADR-0006, and the name prefix is what
bounds it. If that trade is not acceptable, add a required reviewer to the
`production` environment in step 2.

## If you lose this state

This module keeps its state locally and it is gitignored, so it will not
survive a fresh clone. That is the standard chicken-and-egg of bootstrap
modules: it cannot store state in the bucket it creates.

Losing it is recoverable and harmless — nothing is deleted. Re-import the
three resources instead of re-applying:

```sh
terraform import aws_s3_bucket.state principled-tfstate-CHANGEME
terraform import aws_iam_role.deploy principled-github-deploy
terraform import 'aws_iam_openid_connect_provider.github[0]' \
  arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com
```

The state bucket has `prevent_destroy = true`, so Terraform will refuse to
delete it even if you ask. Removing it is a deliberate two-step: drop the
lifecycle block, then destroy.

## Tearing down

```sh
# Remove the application stack first, while the role still exists.
terraform -chdir=.. destroy -var environment=prod

# Then the bootstrap. The bucket needs prevent_destroy removed by hand.
terraform destroy
```
