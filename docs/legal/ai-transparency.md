# AI Transparency Notice (DRAFT — not in force)

> **Status:** Draft skeleton. Not published, not binding. Must be reviewed
> before AI-assisted analysis is exposed to users.

**Classification:** Public.
**Assumed product mode:** No AI system is placed on the market or put into
service yet, so the EU AI Act is not yet triggered.

## AI Act applicability assessment (to be maintained)

Per #28, this assessment is explicit and reassessed when capabilities change.

| Question | Current answer |
| --- | --- |
| Is an AI system placed on the market / put into service? | No |
| Provider and/or deployer role | Not yet determined — assess per product mode |
| Intended purpose | Code-quality / SOLID-principle analysis (not employment, hiring or worker evaluation) |
| Risk classification | To be recorded with reasoning; do **not** assume code analysis is automatically high-risk |
| Article 50 transparency obligations | Apply once users interact with AI or AI-assisted output is shown |

## Disclosure requirements (Article 50) — apply when AI is introduced

- Clearly disclose when a user is interacting with AI or viewing
  AI-generated/AI-assisted output.
- Never present AI findings as deterministic compiler facts; keep
  human-review/uncertainty language where output is probabilistic.
- Surface confidence/limitations and evidence for findings (aligns with the
  analysis result contract, #8).

## Evaluation snapshots and quality communication

Engine quality is reported per rule and per language (#30, story #45), so a
finding can be read with appropriate confidence:

- Precision, recall, false-positive/false-negative rates and calibration
  are visible alongside evidence coverage and sample size.
- Snapshots are versioned and dated; new runs append history, never rewrite
  past claims.
- Quality is never collapsed into an opaque overall "code quality" score.
- Snapshots are built from synthetic, public or explicitly authorised
  corpora — never from private customer code.

## Employment-adjacency boundary

Developer/code-quality analysis is kept technically and contractually distinct
from employment, hiring, worker monitoring or performance evaluation.
Reassess classification if functionality expands into repository analytics,
developer-level metrics, PR evaluation or team dashboards.

## AI literacy

Maintain appropriate AI-literacy measures for personnel developing, operating
or managing the AI system. Track AI Act implementation dates and guidance.
