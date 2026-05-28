# Phase 29.1 - Paid Cohort Activation + Retention Recovery

## Verdict

TRADEVETO PAID COHORT ACTIVATION + RETENTION RECOVERY STRONG PARTIAL ACCOMPLISHED

The first-session activation, daily habit instrumentation, notification usefulness context, and paid/founding cohort analytics were strengthened and deployed. The production proof is `strong_partial`: the implementation is live and the cohort export is working, but elapsed founding cohorts still do not meet the required outcome targets.

This phase cannot be fully accomplished until real elapsed production cohorts prove D2, D7, 2+ active-day, alert-return, and notification usefulness targets.

## Production Deployment

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Deployed commit: `f14098ab4247ab062a50c25c8a44ef854f6d4782`
- Pull: `git pull --ff-only origin main`
- Rebuild: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Container health: `market-alpha-frontend` and `market-alpha-frontend-hot-api` reached healthy state after rebuild.

## Implementation Summary

- Added first-60-second activation CTAs to the first-run starter flow:
  - save starter watchlist symbol
  - start alert setup
  - complete morning briefing
  - continue scanner and symbol investigation
- Added churn/dropoff instrumentation for users who hide onboarding before completing a useful action.
- Expanded first useful action detection for:
  - watchlist
  - scanner
  - alert
  - chart save
  - symbol card
  - compare
  - history/replay
  - morning briefing
- Added symbol intelligence card action tracking for watchlist, alert, full chart, history, performance, compare, and full symbol page actions.
- Added chart workspace save activation tracking.
- Added notification retention ranking and visible Why / Changed / Next context without fabricating claims.
- Expanded admin analytics paid/founding cohort display and the production retention proof export.

## Changed Files

- `frontend/src/components/onboarding/FirstRunStarterCard.tsx`
- `frontend/src/components/symbol/SymbolIntelligenceCard.tsx`
- `frontend/src/components/terminal/SymbolChart.tsx`
- `frontend/src/components/notifications/NotificationBell.tsx`
- `frontend/src/components/admin/AnalyticsDashboard.tsx`
- `frontend/src/lib/server/analytics.ts`
- `frontend/src/lib/retention-cohort-certification.ts`
- `frontend/src/lib/retention-cohort-certification.test.ts`
- `frontend/scripts/phase26-paid-retention-daily-habit-probe.mjs`

## Trust Boundary

- No fake cohort events were created.
- No fake paid users were seeded.
- No synthetic retention was counted.
- Probe/admin users remain excluded through `@tradeveto-probe.local` bot/noise filtering.
- The production proof used a temporary admin session only to read analytics.
- Probe cleanup proof shows zero temporary probe users remaining.
- Same-day activity was not counted as D2 or D7 retention.

## Production Smoke

Artifact: `docs/ops/artifacts/phase-29-1-retention/production-smoke.txt`

All production smoke targets returned HTTP 200:

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
- `/account`
- `/status`

## Retention Proof

Artifact: `docs/ops/artifacts/phase-29-1-retention/paid-cohort-activation-retention-proof.json`

- Generated at: `2026-05-28T08:34:01.921Z`
- Admin analytics status: `200`
- Admin analytics latency: `673 ms`
- Overall status: `strong_partial`
- Elapsed cohort only: `true`
- No synthetic cohort data created: `true`
- Total actors in proof: `969`
- Founding actors: `1`
- Bot/noise filtered actors: `5`

### Founding Cohort Metrics

| Metric | Result | Target | Status |
| --- | ---: | ---: | --- |
| Founding D2 retention | `0%` | `> 10%` | Fail |
| Founding D7 retention | `0%` | `> 6%` | Fail |
| Founding 2+ active-day | `0%` | `> 15%` | Fail |
| Alert-return conversion | `N/A` | `> 12%` | Fail - no founding alert-trigger population |
| Notification useful ratio | `N/A` | `> 55%` | Fail - no founding notification usefulness sample |

### Founding First Useful Actions

| Action | Users |
| --- | ---: |
| Scanner | `1` |
| Watchlist | `0` |
| Alert | `0` |
| Chart save | `0` |
| Symbol card | `0` |
| Compare | `0` |
| History | `0` |
| Replay | `0` |
| Morning briefing | `0` |

### Aggregate Context

Aggregate traffic cannot satisfy paid/founding targets, but it provides context for the retention baseline:

- Aggregate D1 retention: `0.739%` (`7 / 947`)
- Aggregate D2 retention: `0.328%` (`3 / 914`)
- Aggregate D7 retention: `0.123%` (`1 / 816`)
- Aggregate 2+ active-day rate: `0.929%` (`9 / 969`)
- Aggregate 7+ active-day users: `1`

### Habit Loop Signals

- Activation milestones: `236`
- Morning workflows: `46`
- Morning workflow completions: `0`
- Return sessions: `6`
- Watchlist returns: `6`
- Personalized returns: `8`
- Chart returns: `1`
- Scanner returns: `0`
- Replay returns: `0`
- Compare returns: `0`
- History returns: `0`
- Alert returns: `0`
- Workflow dropoffs: `11`
- Churn-risk signals: `9`
- Global fatigue signals: `5`

## Blockers

- Founding member D2 retention is `0%`, below `10%`.
- Founding member D7 retention is `0%`, below `6%`.
- Founding member 2+ active-day retention is `0%`, below `15%`.
- No founding member alert-trigger population exists for alert-return conversion proof.
- No founding member notification usefulness sample exists.
- Meaningful founding sample size is still too small: `1` founding actor.

## Validation

Local validation passed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production validation passed for deployment, health, route smoke, and cohort export. Retention outcome certification remains blocked by elapsed cohort results.

## Artifact Inventory

- `docs/ops/artifacts/phase-29-1-retention/paid-cohort-activation-retention-proof.json`
- `docs/ops/artifacts/phase-29-1-retention/probe-stdout.json`
- `docs/ops/artifacts/phase-29-1-retention/probe-stderr.txt`
- `docs/ops/artifacts/phase-29-1-retention/probe-exit.txt`
- `docs/ops/artifacts/phase-29-1-retention/probe-cleanup-proof.txt`
- `docs/ops/artifacts/phase-29-1-retention/production-smoke.txt`

## Remaining Work

- Convert founding first-session usage from scanner-only into watchlist, alert, chart save, symbol card, replay/history, compare, and morning briefing completions.
- Create a real founding alert-trigger population and measure alert open to return to useful action.
- Collect enough founding notification feedback to calculate a useful/not-useful ratio.
- Reduce onboarding and workflow dropoff enough for elapsed D2, D7, and 2+ active-day retention to pass.
- Re-run certification only after cohorts have aged beyond the D2 and D7 windows.
