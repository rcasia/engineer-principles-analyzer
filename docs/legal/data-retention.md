# Data Retention and Deletion

**Classification:** Public and customer-contractual.

Analysis is **ephemeral by default**: source code and analysis results are not
persisted by the application unless a future feature explicitly requires
retention and updates this schedule before shipping.

| Data category | Persisted? | Location | Retention period | Deletion mechanism |
| --- | --- | --- | --- | --- |
| Submitted source code | No | In memory during request | Not retained after response | Not applicable |
| Analysis results | No | In memory during request | Not retained after response | Not applicable |
| Web metric aggregates | Yes, counts only | In-memory per Lambda environment | Lost on cold start; no cross-instance history | Not applicable; no personal data in the aggregate |
| Evaluation snapshots | Yes, public record | Published with their release | Append-only history | Not applicable; built from synthetic/public/authorised corpora |
| Public exemplar entries | Yes, opt-in | Published showcase | Until correction/removal is requested | Owner correction/removal workflow |
| Application logs | Yes | AWS CloudWatch in `eu-west-1` | Up to 7 days | CloudWatch retention policy |

The append-only event history must not contain raw source code, prompts,
credentials or complete findings by default. Minimal event metadata is
separated from sensitive artifacts, which carry their own retention policy.

Data-subject and customer requests should be sent to the privacy address
published at `/imprint`. Persistent project storage, accounts or customer
repositories require a new retention and deletion review before release.
