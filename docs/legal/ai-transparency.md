# AI Transparency Notice

The public version of this notice is served at `/ai-transparency`. It must be
reviewed by qualified counsel before commercial launch.

**Classification:** Public.

## What uses AI

When configured, TypeSafe Jev performs language detection from submitted source
and an optional filename. The five shipped SOLID rules currently produce
deterministic or heuristic findings in the application; they do not claim
certainty and expose confidence, evidence and limitations.

If language detection is unavailable, the service labels the language unknown
and continues where possible. No employment, hiring, worker-monitoring or
individual-performance decision is supported or intended.

## Human oversight

Every applicable finding displays its method, confidence, evidence,
limitations and whether human review is recommended. Users remain responsible
for validating the source, context and proposed remediation.

## Provider and data flow

TypeSafe receives source text for the language-detection request when that
integration is enabled. See the [Privacy Notice](privacy-policy.md) and
[Subprocessor Register](subprocessors.md). The provider's current public DPA
and privacy policy state that customer input is not used to train or fine-tune
models.

## Regulatory assessment

The operator must maintain its EU AI Act provider/deployer assessment as the
service changes. This notice does not classify the system or replace legal
advice.
