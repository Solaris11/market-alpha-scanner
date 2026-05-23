# Phase 22.3 - Daily-Driver Retention + Notification Usefulness

Date: 2026-05-23

Final verdict: Pending production validation

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

Pending:

```bash
git push origin main
ssh sre@100.68.155.121
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main
tools/db/run-migrations.sh
docker compose build frontend
docker compose up -d frontend
```

## Production Smoke

Pending:

- `/api/health`
- `/api/health/deep`
- `/terminal`
- `/alerts`
- `/feed`
- `/scanner`
- `/symbol/AMD`
- `/api/notifications`

## Remaining Blockers

- No post-release elapsed D2/D7 cohort evidence exists yet.
- Notification useful ratio will remain unproven until real users rate enough delivered notifications.
- Retention target certification requires a follow-up read after eligible cohorts age past 2 and 7 days.

## Final Verdict

Pending production validation.
