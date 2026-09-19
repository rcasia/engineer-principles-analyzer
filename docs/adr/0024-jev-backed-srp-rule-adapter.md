# ADR-0024: Judge SRP with a Jev-backed Rule adapter to validate the core

**Status**: Accepted
**Date**: 2026-09-20

## Context

ADR-0022 built the deterministic SRP heuristic and explicitly deferred the
AI-assisted option (Option 3): no model provider at analysis time, verdicts
non-deterministic and harder to snapshot (#30), and the "never present AI
findings as deterministic facts" burden from #28. That deferral left a gap:
the engine (`AnalyzeSubject`) and the `AnalysisResult` contract (ADR-0013)
have only ever been exercised by deterministic rules, so we have no evidence
they behave with a genuinely external, probabilistic judgment source — the
kind of rule #11–#14 and beyond will increasingly be.

TypeSafe's Jev (see the `typesafe-ai` skill and https://docs.typesafe.ai) is
the smallest such source available: one `POST /v1/systemone` call turns a
state plus typed questions (Choice/Score/Noul) into calibrated probabilities
and confidence, with no SDK required. This ADR covers the first version of
that adapter, scoped to *validating the core*, not to production analysis.

## Decision Drivers

- **No new runtime dependencies** (ADR-0008). Anything `core` imports ships
  in the `principled` npm tarball. The official SDKs are not needed to call
  one HTTPS endpoint.
- **The domain has no I/O.** The HTTP boundary must sit behind an injected
  port, like every other adapter.
- **#28 honesty about AI.** An AI probability must never arrive dressed as a
  deterministic fact: `ai_assisted` method, sub-1.0 confidence, disclosed
  limitations and human-review framing are mandatory fields, not docs.
- **Data-flow restraint.** The rule sees `{ sourceCode, language }` only —
  never a project, never anything person-level. Failure reasons reach
  `AnalysisFailed` events, which may be persisted (#33 "Sensitive data"), so
  errors must carry status codes, never bodies, state or credentials.
- **TypeSafe's own terms.** TypeSafe commits not to train models on user data
  (privacy policy), offers a DPA, and retains API data per that DPA — with
  zero data retention an enterprise-only arrangement. Sending user code to
  Jev is therefore a subprocessor relationship the moment the *product* does
  it, even though a developer running a script is not.

## Considered Options

### Option 1: Depend on the official TypeSafe SDK in core

Smallest code: `npm i @typesafe-ai/sdk`, call the typed client.

- **Pros**: Less hand-written wire code; SDK owns retries and shape changes.
- **Cons**: A runtime dependency in the published bundle against ADR-0008's
  explicit constraint, plus audit surface (ADR-0011) for every future
  language the SDK pulls in. Rejected.

### Option 2: Fetch-injected port with pure wire functions (chosen)

A `JevClient` port (`evaluateNoul`), pure domain functions that build the
request body and validate the response, an `HttpJevClient` adapter taking an
injected `fetch`, and an `InMemoryJevClient` with scripted answers for tests
and offline validation.

- **Pros**: Zero dependencies; `fetch` comes from the composition root (Node
  20+ and Bun both ship it). Strict response validation turns TypeSafe-side
  shape drift into a loud `InvalidJevResponseError` the engine isolates into
  `unable_to_analyze`. The in-memory adapter keeps the "real adapter over a
  mock" testing rule.
- **Cons**: Hand-rolled wire code must track TypeSafe's API; no SDK retries
  (acceptable for a validation probe — failures are verdicts of
  `unable_to_analyze`, not silent gaps).

### Option 3: Choice over verdicts vs Noul on the condition

A `Choice` of `violation/compliant/uncertain` returns the model's own
confidence; a `Noul` ("does this violate SRP?") returns one probability the
code maps through explicit cutoffs.

- **Pros of Choice**: Confidence comes from the model, not from arithmetic.
- **Cons of Choice**: The model, not the code, would own the
  violation/uncertain boundary — exactly the policy the skill says to keep
  explicit ("code owns the workflow; thresholds evaluated on your data").
  Chosen: **Noul**, with cutoffs (0.75/0.25) and confidence
  (`min(0.9, |v-0.5|*2)`) as code-owned, unevaluated starting defaults to be
  tuned against the corpus (#27).

### Option 4: Wire the rule into the web/CLI now vs validation-only

- **Pros of wiring now**: Real user feedback immediately.
- **Cons of wiring now**: Every analysis would need a key, pay latency and
  cost, and — decisively — start sending user code to a third party, which
  triggers the subprocessor listing, the DPA review and the AI-transparency
  update before a single request flows. Chosen: **validation-only**. The rule
  is exported from `@principled/core` and runnable via
  `scripts/validate-core-with-jev.ts`, but no composition root registers it.

## Decision

Ship v1 as a `jev` slice plus one thin `Rule` adapter, unregistered:

```
packages/core/src/jev/
  domain/
    jev-request.ts        pure SystemOne request-body builder
    jev-response.ts       strict untrusted-body parser -> { value, model }
    noul-verdict.ts       cutoffs + confidence policy (0.75/0.25, cap 0.9)
    evidence-excerpt.ts   first non-empty line: the only honest evidence
                          a location-free model verdict can carry
  application/
    jev-client.port.ts    JevClient.evaluateNoul + JevTransportError
                          (no bodies/state/keys in errors, ever)
  infrastructure/
    http-jev-client.ts    fetch-injected, key in Authorization header only
    in-memory-jev-client.ts scripted answers; validates its own fixtures
packages/core/src/principles/srp/infrastructure/
  jev-srp-rule.ts         JevSrpRule (id "solid.srp.jev",
                          analyzer principled-solid-srp-jev v1)
```

`JevSrpRule` asks one Noul over `{ sourceCode, language }`, maps the answer
to an `ai_assisted` `AnalysisResult` with `humanReviewRecommended: true` on
*every* status (a model's silence is not permission to act), violation
evidence pointing at the subject's first non-empty line, the three known
limitations disclosed verbatim, and `evaluationMetadata.jevModel` recording
the answering model for snapshot attribution (#30). Transport and wire
failures throw; the engine turns them into `unable_to_analyze`.

## Consequences

### Positive

- The engine and the result contract are now validated against a genuinely
  external, probabilistic judgment source — including the failure path, which
  the integration tests cover through `AnalyzeSubject` itself. A live run
  (`scripts/validate-core-with-jev.ts`, `TYPESAFE_API_KEY` required) agreed
  with the heuristic on a god-class (violation, noul 0.96) and a cohesive
  class (compliant, noul 0.08), and diverged honestly on a too-small class
  (heuristic `uncertain`, Jev compliant at 0.03) — the probe signal working
  as designed.
- Mutation cover on the new code kills every mutant except one
  formally-equivalent survivor (`typeof value === "number" &&
  Number.isFinite(value)` → `true && ...` in the wire parser): no JS value
  is both a non-number and finite, so no test can distinguish it, and the
  `typeof` half carries the TS narrowing. Same class of analysed-equivalent
  survivor as ADR-0022's.
- #11–#14 get a second worked pattern (AI-backed rule) next to ADR-0022's
  heuristic one, with the policy-vs-model split made explicit in code.
- No dependency, audit or bundle impact: `bun run audit` and the CLI
  tarball check are unaffected.

### Negative

- Hand-rolled wire code drifts if TypeSafe changes the API; the strict
  parser converts that drift into loud failures, but someone still has to
  update the parser.
- Cutoffs (0.75/0.25) and the 0.9 confidence cap are reasoned, unmeasured
  choices. Until tuned against the corpus (#27), boundary verdicts should be
  treated as probe output, not judgments.
- Violation evidence (first non-empty line) is deliberately weak — honest,
  but weak. Any consumer rendering it as "the offending lines" would be
  misreading the result; the limitations say so.

### Risks and mitigations

- *Risk*: A future change registers the rule in a user-facing composition
  root without the legal plumbing. *Mitigation*: this ADR names the
  triggers explicitly — `docs/legal/subprocessors.md` row (TypeSafe:
  SRP judgments; source code + language; transfer mechanism to assess),
  `ai-transparency.md` (relevant the moment AI-assisted analysis is exposed
  to users), and DPA review noting ZDR is enterprise-only. The validation
  script's header repeats the warning.
- *Risk*: Source code sent to Jev is retained per TypeSafe's DPA during
  validation runs. *Mitigation*: v1 sends only single pasted-style subjects
  chosen by the developer running the script — never harvested user data —
  and the script refuses to run without an explicit key.
- *Risk*: Non-deterministic verdicts get screenshotted into gospel.
  *Mitigation*: `ai_assisted`, capped confidence, always-review and the
  recorded model version travel with every verdict; repeat runs are expected
  to disagree and say so in the limitations.
- *Risk*: Thresholds rot silently as the model revs. *Mitigation*: same
  feedback loop as ADR-0022 — rule-level precision/recall against the
  versioned corpus (#27, #30); retuning is a rule-version bump.

## Related

- ADR-0022 (the deferred AI option this validates toward), ADR-0013 (the
  contract under validation), ADR-0014 (the engine under validation),
  ADR-0008 (why there is no SDK).
- #10 (the probed judgment), #27 (where cutoffs get measured), #28 (the
  honesty and data-flow obligations), #30 (why the model is recorded).
- TypeSafe legal: privacy policy (no training on user data), DPA, MCA —
  see https://docs.typesafe.ai/legal; ZDR via privacy@typesafe.ai.
