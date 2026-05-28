# Phase 28.7 - Paid Retention + Daily Dependence Proof

## Verdict

TRADEVETO PAID RETENTION + DAILY DEPENDENCE PROOF NOT ACCOMPLISHED

The implementation and proof path are in place, but elapsed paid/founding cohorts do not prove daily dependence. The production admin analytics probe returned `strong_partial` because it found real cohort data and instrumentation, but Phase 28.7 cannot be certified while founding D2, D7, and 2+ active-day retention remain at 0% and alert/notification samples are missing.

## Production Deployment

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Deployed commit: `c766f10bcaf909649c8c10cf6c0de124e8860664`
- Deployment command: `git pull --ff-only origin main` followed by `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Container health: `market-alpha-frontend` and `market-alpha-frontend-hot-api` reached healthy state after rebuild.

## Implementation Boundary

- `frontend/src/lib/server/analytics.ts` now explicitly classifies any `@tradeveto-probe.local` analytics actor as `bot_or_noise_filtered` before paid/free/legacy/anonymous cohort segmentation.
- No synthetic retention data was created.
- No fake paid users, notification feedback, alert returns, or cohort events were seeded.
- The production proof used a temporary admin session to read analytics. The temporary probe user was deleted after the run.

## Production Smoke

Artifact: `docs/ops/artifacts/phase-28-7-retention/production-smoke.txt`

All smoke targets returned HTTP 200:

- `/api/health`
- `/api/health/deep`
- `/terminal`
- `/discover`
- `/scanner`
- `/alerts`
- `/feed`
- `/history`
- `/performance`
- `/symbol/AMD`

## Retention Proof

Artifact: `docs/ops/artifacts/phase-28-7-retention/paid-retention-daily-dependence-proof.json`

- Generated at: `2026-05-28T04:42:58.056Z`
- Admin analytics status: `200`
- Admin analytics latency: `550 ms`
- Elapsed cohort only: `true`
- No synthetic cohort data created: `true`
- Total actors in proof: `969`
- Founding member actors: `1`
- Bot/noise filtered actors: `5`

### Founding Cohort Metrics

| Metric | Result | Target | Status |
| --- | ---: | ---: | --- |
| Founding D2 retention | `0%` | `> 10%` | Fail |
| Founding D7 retention | `0%` | `> 6%` | Fail |
| Founding 2+ active-day | `0%` | `> 15%` | Fail |
| Alert-return conversion | `N/A` | `> 12%` | Fail - no founding alert-trigger population |
| Notification useful ratio | `N/A` | `> 55%` | Fail - no founding notification usefulness sample |

### Aggregate Context

The aggregate cohort remains weak and cannot be used to satisfy paid/founding targets:

- Aggregate D1 retention: `0.739%` (`7 / 947`)
- Aggregate D2 retention: `0.328%` (`3 / 914`)
- Aggregate D7 retention: `0.123%` (`1 / 816`)
- Aggregate 2+ active-day rate: `0.929%` (`9 / 969`)
- Aggregate 7+ active-day users: `1`

### Activation And Habit Signals

Founding first useful actions:

- Watchlist: `0`
- Scanner: `1`
- Alert: `0`
- Chart save: `0`
- Replay: `0`
- Morning briefing: `0`

Workflow return signals:

- Return sessions: `6`
- Watchlist returns: `6`
- Personalized returns: `8`
- Chart returns: `1`
- Alert returns: `0`
- Replay returns: `0`
- Scanner returns: `0`
- Morning workflow completions: `0`
- Workflow dropoffs: `11`
- Churn-risk signals: `9`

## Blockers

- Founding member D2 retention is `0%`, below `10%`.
- Founding member D7 retention is `0%`, below `6%`.
- Founding member 2+ active-day retention is `0%`, below `15%`.
- No founding member alert-trigger population exists for alert-return conversion proof.
- No founding member notification usefulness sample exists.
- Meaningful paid/founding sample size is still too small: `1` founding actor.

## Validation

Local validation passed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production validation passed for deployment and route smoke, but retention certification failed the paid/founding outcome targets.

## Artifact Inventory

- `docs/ops/artifacts/phase-28-7-retention/paid-retention-daily-dependence-proof.json`
- `docs/ops/artifacts/phase-28-7-retention/production-smoke.txt`
- `docs/ops/artifacts/phase-28-7-retention/probe-cleanup-proof.txt`

## Remaining Work

- Grow actual paid/founding cohorts before recertification.
- Convert first-session activation into first watchlist, alert, chart save, replay, and morning briefing completion, not only scanner usage.
- Generate real alert-trigger populations and measure alert open to return to useful action.
- Collect notification usefulness feedback with enough sample depth to calculate a meaningful ratio.
- Reduce onboarding and daily workflow dropoff until founding D2/D7/2+ active-day targets are met by elapsed production cohorts.
