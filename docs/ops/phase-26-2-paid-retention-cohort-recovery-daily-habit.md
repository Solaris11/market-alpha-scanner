# Phase 26.2 - Paid Retention Cohort Recovery + Daily Habit Dominance

Date: 2026-05-27
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO PAID RETENTION COHORT RECOVERY + DAILY HABIT STRONG PARTIAL ACCOMPLISHED

The implementation is deployed and production proof is captured, but the elapsed founding-member cohort has not met the required targets.

This phase can only be marked accomplished after elapsed founding-member production cohorts meet every target:

- Founding D2 retention greater than 8%.
- Founding D7 retention greater than 4%.
- Founding 2+ active-day retention greater than 10%.
- Founding alert-return conversion greater than 12%.
- Founding notification useful ratio greater than 55%.

Same-day activity, probe users, and synthetic events are not valid success evidence.

## Implemented

- First useful action tracking now records each activation action once per device instead of stopping after the first global action.
- Paid cohort aggregation recognizes additional first-action aliases for scanner, alert, watchlist, replay, and morning briefing activation.
- Workflow abandonment emits `churn_risk_signal` alongside `workflow_dropoff`.
- Long return gaps emit `churn_risk_signal` so repeat non-return risk can be separated from ordinary route usage.
- Notification feedback now carries feed category, severity, source key, and adaptive priority context.
- Notification "not useful" feedback and high-volume bulk clears emit churn-risk signals for notification fatigue.
- Intelligence-feed notification materialization now reads category-level usefulness feedback and suppresses low-value non-critical categories after repeated negative feedback.
- Admin analytics now exposes churn-risk signal counts in the daily-driver habit loop panel.
- Added production proof command:
  - `npm --prefix frontend run probe:phase26:paid-retention`
- Added production artifact target:
  - `docs/ops/artifacts/phase-26-2-retention/paid-retention-daily-habit-proof.json`

## Evidence Boundary

The proof probe reads authenticated production admin analytics only. It creates a temporary admin session when needed to access `/api/admin/analytics`, but it does not create cohort events, seed retention activity, backfill D2/D7 outcomes, or manufacture notification usefulness.

The probe exports:

- cohort segments and sample sizes
- D1/D2/D7 evidence
- first useful action counts
- alert-return metrics
- notification usefulness metrics
- workflow-return metrics
- churn-risk metrics
- final status derived from elapsed production cohorts

## Local Validation

Local validation passed on 2026-05-27:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 516 passing tests
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

## Production Deployment

Production was pulled, migrated, rebuilt, and smoke tested on 2026-05-27.

Deployment commands:

- `git pull --ff-only origin main`
- `tools/db/run-migrations.sh`
- `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`

Migration result:

- `20260527_021500_phase26_retention_notification_context.sql` applied.
- Previously unapplied Phase 25 analytics migrations were also applied by the migration ledger runner.

Container result:

- `market-alpha-frontend` healthy.
- `market-alpha-frontend-hot-api` healthy.
- `market-alpha-scanner-market-alpha-postgres-1` healthy.

Production smoke:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.312 s |
| `/api/health/deep` | 200 | 0.165 s |
| `/terminal` | 200 | 0.390 s |
| `/discover` | 200 | 0.219 s |
| `/scanner` | 200 | 0.156 s |
| `/alerts` | 200 | 0.133 s |
| `/feed` | 200 | 0.353 s |
| `/history` | 200 | 0.141 s |
| `/strategy-labs` | 200 | 0.137 s |
| `/symbol/AMD` | 200 | 0.246 s |

## Production Evidence

Production proof command:

- `node scripts/phase26-paid-retention-daily-habit-probe.mjs`

Production artifact:

- `docs/ops/artifacts/phase-26-2-retention/paid-retention-daily-habit-proof.json`

Probe result:

- `/api/admin/analytics?range=90d` returned `200` in `468ms`.
- The probe created a temporary admin session only for authenticated analytics access.
- The probe did not create cohort events, seed retention activity, or fabricate D2/D7 outcomes.
- Overall status: `strong_partial`.

Founding-member proof:

| Metric | Evidence | Target | Result |
| --- | ---: | ---: | --- |
| Founding actors | 1 | n/a | sample exists |
| Founding D2 retention | 0 / 1 = 0% | > 8% | fail |
| Founding D7 retention | 0 / 1 = 0% | > 4% | fail |
| Founding 2+ active-day retention | 0 / 1 = 0% | > 10% | fail |
| Founding alert-return conversion | no alert-trigger population | > 12% | fail |
| Founding notification useful ratio | no usefulness sample | > 55% | fail |

Aggregate 90-day cohort evidence:

| Metric | Evidence |
| --- | ---: |
| Total actors segmented | 914 |
| Bot/noise filtered actors | 2 |
| Aggregate D1 retention | 7 / 914 = 0.77% |
| Aggregate D2 retention | 3 / 911 = 0.33% |
| Aggregate D7 retention | 1 / 679 = 0.15% |
| Aggregate 2+ active-day | 9 / 914 = 0.98% |

Workflow-return metrics:

| Metric | Count |
| --- | ---: |
| Activation milestones | 19 |
| Return sessions | 3 |
| Morning workflows | 7 |
| Morning completions | 0 |
| Personalized returns | 5 |
| Watchlist returns | 3 |
| Scanner returns | 0 |
| Chart returns | 0 |
| Compare returns | 0 |
| Replay returns | 0 |
| Alert returns | 0 |
| Strategy returns | 0 |
| Workflow dropoffs | 2 |
| Churn-risk signals | 0 |

Notification usefulness:

| Metric | Evidence |
| --- | ---: |
| Founding useful feedback | 0 |
| Founding feedback total | 0 |
| Founding useful ratio | N/A |
| Global fatigue signals | 5 |
| Global useful feedback | 0 |
| Global not-useful feedback | 0 |

## Remaining Blockers

- Founding D2 retention is 0%, below 8%.
- Founding D7 retention is 0%, below 4%.
- Founding 2+ active-day retention is 0%, below 10%.
- No founding-member alert-trigger population exists.
- No founding-member notification usefulness sample exists.
- Aggregate D2/D7 retention remains below 1%, so primary-platform viability is still not proven.
