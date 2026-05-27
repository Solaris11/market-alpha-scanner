# Phase 26.2 - Paid Retention Cohort Recovery + Daily Habit Dominance

Date: 2026-05-27
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

Pending production cohort proof.

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

Pending production pull, migration, rebuild, and smoke.

## Production Evidence

Pending production retention export.

## Remaining Blockers

Pending elapsed cohort export.
