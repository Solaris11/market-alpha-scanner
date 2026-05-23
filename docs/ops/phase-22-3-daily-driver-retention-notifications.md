# Phase 22.3 - Daily-Driver Retention + Notification Usefulness

Date: 2026-05-23

Final verdict: STRONG PARTIAL ACCOMPLISHED

## Scope

Phase 22.3 targets the retention blocker directly:

- Morning intelligence workflow
- Continue-where-you-left-off workflow memory
- Scanner, replay, watchlist, alert, and personalized return loops
- Durable notification usefulness feedback
- Notification fatigue/category reporting
- Retention dashboard coverage for D1, D2, D7, 2+ active-day, 7+ active-day, scanner reuse, watchlist reuse, alert return, replay return, and notification feedback

## Implementation

Implemented locally:

- Added a durable `notification_feedback` table with per-user/per-notification uniqueness.
- Added `/api/notifications/feedback` with CSRF, origin validation, rate limiting, request-size limiting, ownership checks, and upsert semantics.
- Extended notification list responses with the current user's previous feedback state.
- Updated the notification bell so useful/not-useful votes persist server-side and still emit first-party analytics.
- Added notification-open return attribution for alert, scanner, replay, and personalized intelligence routes.
- Added a daily-driver `Continue last workflow` action when workflow memory exists.
- Added a `Notification usefulness` habit loop to the daily-driver model.
- Expanded admin analytics with D1/D2/D7 cohort proof, 2+ and 7+ active-day behavior, durable notification feedback, category usefulness, and fatigue signals.

## Retention Proof Boundary

The release creates the instrumentation and product loops needed to measure retention improvement. It does not prove the requested post-release targets yet because those require elapsed production cohorts after deployment:

- D2 retention > 8%
- D7 retention > 4%
- 2+ active-day retention > 10%
- Alert-return conversion > 12%
- Notification useful ratio > 55%

Until eligible post-release cohorts age into D2 and D7 windows, the honest certification state can only be strong partial if production deployment and smoke pass.

## Local Validation

Passed:

```bash
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
git diff --check
```

## Production Workflow

Completed:

```bash
git push origin main
ssh sre@100.68.155.121
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main
tools/db/run-migrations.sh
docker compose build market-alpha-frontend
docker compose up -d market-alpha-frontend
```

Production proof:

- Local implementation commit: `4b6c9872` - `Add daily driver notification usefulness loops`
- Production pull reached: `4b6c987`
- Migrations applied during deploy:
  - `20260523_180000_phase22_hot_telemetry_indexes.sql`
  - `20260523_190000_notification_usefulness_feedback.sql`
- `notification_feedback` table exists in production.
- `schema_migrations` contains `20260523_190000_notification_usefulness_feedback.sql`.
- Production frontend image: `sha256:94a4c11abc0c3bf6bd37d183f6829db884ed87a223408dc518cfa982afdc182e`
- `market-alpha-frontend`: healthy, restart count `0`

## Production Smoke

Passed:

- `/api/health`: `ok: true`
- `/api/health/deep`: `ok: true`, DB ok, scanner fresh, backups ok
- `/terminal`: `200`
- `/alerts`: `200`
- `/feed`: `200`
- `/scanner`: `200`
- `/symbol/AMD`: `200`
- `/api/notifications`: `401` unauthenticated as expected
- `/api/notifications/feedback`: `401` unauthenticated as expected

Authenticated production contract probe:

- Temporary signed-in probe user created directly in production DB.
- Session cookie and CSRF flow succeeded.
- `/api/notifications/feedback` returned `200`.
- Durable `notification_feedback` row verified with `feedback = useful` and `notification_type = signal`.
- Probe user was deleted after verification; cascade cleanup removed probe notification/feedback rows.

Probe result:

```json
{"feedbackStatus":200,"ok":true,"rows":1}
```

## Current Production Retention Snapshot

This is pre/post-release mixed telemetry, not elapsed Phase 22.3 cohort proof:

| Metric | Eligible / actors | Retained / users | Rate |
|---|---:|---:|---:|
| D1 retention | 839 | 7 | 0.83% |
| D2 retention | 816 | 3 | 0.37% |
| D7 retention | 439 | 1 | 0.23% |
| 2+ active-day users | 896 | 9 | 1.00% |
| 7+ active-day users | 896 | 1 | 0.11% |

Durable notification feedback in the new table after probe cleanup:

- Useful: `0`
- Not useful: `0`
- Total: `0`

## Remaining Blockers

- No post-release elapsed D2/D7 cohort evidence exists yet.
- Current mixed production retention remains far below the Phase 22.3 targets.
- Notification useful ratio will remain unproven until real users rate enough delivered notifications.
- Retention target certification requires a follow-up read after eligible cohorts age past 2 and 7 days.

## Final Verdict

TRADEVETO DAILY-DRIVER RETENTION + NOTIFICATION USEFULNESS STRONG PARTIAL ACCOMPLISHED
