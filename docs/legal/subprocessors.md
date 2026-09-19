# Subprocessors (DRAFT — not in force)

> **Status:** Draft skeleton. Not published, not binding.

**Classification:** Public.
**Assumed product mode:** No customer data is processed, so there are no
subprocessors of customer data today.

## Register

Every third party that processes customer data must appear here with purpose,
data categories, location and transfer mechanism (acceptance criterion, #28).

| Subprocessor | Purpose | Data categories | Location | Transfer mechanism |
| --- | --- | --- | --- | --- |
| _none yet_ | — | — | — | — |

## Infrastructure note (not a customer subprocessor yet)

The application is hosted on AWS with the region defaulting to `eu-west-1`
(Ireland) — see `infra/`. AWS becomes a subprocessor of *customer* data only
once the hosted analysis service processes customer content. Hosting location
is recorded here for transfer assessment; it is not offered to users as a
residency guarantee.

## Change process

- Add a subprocessor here in the same commit that introduces it.
- Notify customers of new subprocessors per the DPA before they process data.
