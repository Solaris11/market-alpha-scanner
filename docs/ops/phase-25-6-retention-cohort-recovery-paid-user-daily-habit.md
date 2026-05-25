# Phase 25.6 - Retention Cohort Recovery + Paid User Daily Habit

## Scope

Phase 25.6 adds a hard proof boundary for daily-driver retention. The implementation separates paid early-access retention from historical/noisy aggregate traffic and prevents same-day product instrumentation from being certified as retention success.

## Implemented

- Added paid-user cohort segmentation to admin analytics:
  - founding members
  - free research preview
  - legacy users
  - anonymous users
  - bot/noise filtered users
- Added elapsed-cohort gates for:
  - D2 retention greater than 8%
  - D7 retention greater than 4%
  - 2+ active-day retention greater than 10%
  - alert-return conversion greater than 12%
  - notification useful ratio greater than 55%
- Added first useful action counts by cohort:
  - first watchlist
  - first scanner
  - first alert
  - first chart save
  - first replay
  - first morning briefing completion
- Added admin dashboard cohort panel with paid/founding sample size, noise filtering, target gates, blockers, and segment-level pass/fail evidence.
- Added production proof probe:
  - `npm --prefix frontend run probe:phase25:retention-cohort`
  - output: `docs/ops/artifacts/phase-25-6-retention-cohort-recovery-paid-user-daily-habit/retention-cohort-proof.json`

## Evidence Boundary

The retention proof uses production `analytics_events` only. The proof probe creates a temporary admin session only to read `/api/admin/analytics`; it does not create cohort events, seed retention activity, or manufacture D2/D7 outcomes.

Certification can only be `ACCOMPLISHED` when elapsed founding-member cohorts meet all targets. If instrumentation ships but founding-member cohorts have not aged or do not meet targets, the correct result is `STRONG PARTIAL ACCOMPLISHED`.

## Validation

Local validation pending.

Production deployment pending.

Production retention proof pending.

## Production Evidence

| Evidence | Result |
| --- | --- |
| Production deploy | Pending |
| Production smoke | Pending |
| Admin analytics retention probe | Pending |
| Founding-member sample size | Pending |
| D2 retention | Pending |
| D7 retention | Pending |
| 2+ active-day retention | Pending |
| Alert-return conversion | Pending |
| Notification useful ratio | Pending |

## Remaining Blockers

- Real elapsed paid/founding cohort performance must be measured after production deployment.
- Same-day or synthetic data is not valid retention certification evidence.

## Verdict

Pending production proof.
