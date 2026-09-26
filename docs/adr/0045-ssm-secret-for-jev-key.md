# ADR-0045: Deliver the Jev API key to Lambda from SSM Parameter Store

**Status**: Accepted (Supersedes [0037](0037-keyless-detection-degrades.md) key-delivery mechanism; its degrade principle stands)
**Date**: 2026-09-26

## Context

Jev language detection needs a `TYPESAFE_API_KEY`, and the only delivery
channel was a sensitive `typesafe_api_key` Terraform variable injected as
the Lambda's env var. That channel has two problems:

- The value travels through `TF_VAR_` (or `-var`), plan output, and
  Terraform state. Anyone who can read state can read the key.
- The production deploy job cannot supply it: the pipeline holds no secret
  for it, and wiring one in means the key lives in GitHub. In practice
  production deploys keyless, and every pipeline deploy would reset a
  hand-applied key to `null`.

Keyless still works (ADR-0040, ADR-0044: heuristics analyze `"unknown"`
generically), but detection accuracy — and any future Jev-backed rule —
needs the real key on the function without teaching the pipeline a secret.

## Decision Drivers

- The deploy pipeline must stay secret-free (public repository, fork-safe
  gates).
- The real key value must appear in neither Terraform state, nor plans,
  nor GitHub configuration.
- Rotation must not require a redeploy.
- A missing or wrong key must keep degrading to keyless, never fail the
  cold start (ADR-0037).
- No new recurring cost (the stack's cost discipline: free tier or it does
  not ship).

## Considered Options

### Option 1: Keep the Terraform variable (rejected)

- **Pros**: No change; already implemented.
- **Cons**: Secret in state and plans; CI cannot supply it, so production
  stays keyless and hand-applied keys get wiped by the next pipeline
  deploy.

### Option 2: Resolve the SSM value at deploy time via a data source (rejected)

- **Pros**: Secret lives in SSM; Lambda keeps a plain env var.
- **Cons**: The value still lands in Terraform state (data sources are
  stored), so the state-reads-key problem survives; rotation still needs
  a redeploy to refresh the env var; the deploy role needs SSM read
  access to the secret anyway.

### Option 3: Runtime read from SSM Parameter Store (chosen)

- **Pros**: Terraform manages only the parameter *name* (non-sensitive);
  the value is written once out of band and never enters state, plans, or
  GitHub. Rotation is a `put-parameter` with no redeploy. The deploy job
  needs zero secret configuration.
- **Cons**: One SSM `GetParameter` per cold start (cached in module scope
  across warm invocations); a new IAM surface (read + decrypt) to keep
  least-privilege; one more out-of-band operator step.

## Decision

Option 3:

- The operator creates an SSM `SecureString` parameter named
  `/<name-prefix>/typesafe-api-key` by hand, once per environment — it is
  deliberately not a Terraform resource, so no deploy credential can ever
  write or read the value and the one-time bootstrap needs no new
  permissions. Encryption uses the default `aws/ssm` key: no
  customer-managed key, no extra cost. Terraform only assumes the naming
  convention (a local, exposed as the `typesafe_api_key_ssm_parameter`
  output) and never touches the value.
- The Lambda gets only the parameter *name* as
  `TYPESAFE_API_KEY_SSM_PARAMETER`. At cold start `lambda-entry.ts`
  resolves the key via `apiKeyFor`: a literal `TYPESAFE_API_KEY` env var
  wins when set (local runs, debugging), else the named SSM parameter is
  read with `WithDecryption`, else keyless. Any failure — missing
  parameter, denied access, unreachable endpoint — resolves to `undefined`,
  so `detectorFor` runs keyless instead of throwing.
- The execution role gets `ssm:GetParameter` on exactly that parameter
  ARN plus `kms:Decrypt` on exactly the `alias/aws/ssm` key. Managing an
  execution-role policy is already within the deploy role's existing IAM
  scope, so neither the pipeline nor the one-time bootstrap needs any new
  permission for this change.
- The `typesafe_api_key` Terraform variable is removed: one source of
  truth, no precedence question. Operators holding a `TF_VAR_` from the
  old flow unset it and `put-parameter` once instead.

## Consequences

### Positive

- Pipeline deploys carry no secret and cannot wipe the key; the value is
  outside Terraform state entirely.
- Rotation (and initial set) is one CLI call, effective at the next cold
  start, with no build or deploy.
- Local and CI behavior is unchanged: no parameter, no env, keyless — the
  gates still run with zero secrets.

### Negative

- Production runs detection-keyless until the operator creates the
  parameter — a quieter version of ADR-0037's misconfiguration risk,
  mitigated by the `typesafe_api_key_ssm_parameter` output and the
  `infra/README.md` runbook. A wrong value fails Jev auth, which likewise
  falls back to `"unknown"` rather than failing.
- One more IAM surface to review; KMS scoping pins the default SSM key
  alias.

### Risks and mitigations

- **Nobody sets the secret**: mitigated by the output naming the exact
  parameter, the runbook, and the fact that analysis still works
  (generically) without it — the failure is degraded accuracy, not an
  outage.
- **IAM misconfiguration fails reads**: same degrade path as a missing
  key — keyless, logged nowhere new. Deliberate: startup must not depend
  on the secret (ADR-0037).
- **Cold-start latency**: one regional SSM call per cold start, then
  cached; no per-request cost.
