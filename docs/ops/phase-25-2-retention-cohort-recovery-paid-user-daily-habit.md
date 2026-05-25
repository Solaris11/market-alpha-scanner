# Phase 25.2 - Retention Cohort Recovery + Paid User Daily Habit

Date: 2026-05-24
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO RETENTION COHORT RECOVERY + PAID USER DAILY HABIT STRONG PARTIAL ACCOMPLISHED

This phase strengthens the activation, return-loop, notification-quality, workflow-continuity, and retention analytics systems and deploys them to production. It is not marked fully accomplished because D2, D7, 2+ active-day, alert-return conversion, and notification-usefulness targets require elapsed real paid-user cohorts.

Current retention problem statement remains the hard proof baseline:

- D2 retention: 0.36%
- D7 retention: 0.23%
- 2+ active-day: 1%

## Implemented Changes

- First-session activation:
  - Added durable `activation_milestone` telemetry for first watchlist, scanner, compare, alert, replay, symbol investigation, chart, strategy, and morning command actions.
  - First-run onboarding now records scanner, watchlist, symbol, chart, and morning command activation milestones without storing private user data.
  - The Daily Driver panel now exposes a first-session activation ladder tied to measurable events.
- Morning command center and return loops:
  - Daily Driver now distinguishes scanner return, scanner habit loop, watchlist return, replay return, chart return, compare return, alert return, and strategy return.
  - Returning scanner sessions emit `scanner_habit_loop`.
  - Returning symbol sessions emit `chart_return`.
  - Returning replay/history sessions emit `history_return`.
  - Returning compare-mode sessions emit `compare_return`.
- Continue-where-you-left-off:
  - Added explicit continuation proof surfaces for scanner state, chart state, compare state, history investigation, replay workflow, and strategy workflow.
  - These are visible in Terminal and tied to `workflow_continuity` telemetry.
- Notification quality:
  - Added product-level proof controls for fatigue suppression, adaptive relevance, category quality, intelligent prioritization, and quieting low-value notifications.
  - Existing useful/not-useful notification feedback remains the quality gate.
- Retention analytics:
  - Added `workflow_dropoff` telemetry for core workflow exits without useful interaction.
  - Admin analytics now displays activation milestones, scanner habit loops, chart returns, compare returns, history returns, and workflow dropoffs.
  - Production trust monitoring now includes activation, chart-return, compare-return, and dropoff counts.
  - Fixed the trust retention query so `strategy_return` is selected into monitoring results instead of always reading as zero.

## Database

Added:

- `db/migrations/20260524_180000_retention_cohort_recovery_events.sql`

The migration adds a partial index for the new retention recovery events:

- `activation_milestone`
- `chart_return`
- `compare_return`
- `history_return`
- `scanner_habit_loop`
- `workflow_dropoff`

## Validation

Local validation:

- `npm --prefix frontend run lint` - passed
- `npm --prefix frontend test -- daily-driver-retention --runInBand` - passed as part of the repo test runner, 502 passing tests
- `npm --prefix frontend test -- analytics-policy --runInBand` - passed as part of the repo test runner, 502 passing tests
- `npm --prefix frontend test -- --runInBand` - passed, 502 passing tests
- `npm --prefix frontend run build` - passed
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings
- `git diff --check` - passed

Production deployment:

- Pending final deploy in this artifact revision.

Production smoke:

- Pending final smoke in this artifact revision.

## Retention Targets

The production cohort targets remain:

- D2 retention > 8%
- D7 retention > 4%
- 2+ active-day retention > 10%
- Alert-return conversion > 12%
- Notification useful ratio > 55%

## Remaining Blockers

- Real elapsed paid-user cohorts have not yet proven the targets.
- This release can improve measurement and product loops, but it cannot honestly claim retention recovery until enough users return after the D2 and D7 windows.
- Paid-user cohort segmentation must be reviewed after deployment using production analytics.
- Alert-trigger to return-session attribution still needs real triggered-alert volume before conversion can be certified.

## Follow-Up Measurement Plan

- Review admin analytics after D1, D2, and D7 cohort windows elapse.
- Segment paid early-access users from anonymous/free visitors.
- Track whether activation milestones reduce first-session abandonment.
- Compare scanner habit loops, chart returns, compare returns, and watchlist returns before and after this release.
- Reduce notification categories with elevated not-useful feedback or dropoff correlation.
