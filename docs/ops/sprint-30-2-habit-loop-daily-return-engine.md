# Sprint 30.2 - Habit Loop + Daily Return Engine

## Verdict

TRADEVETO HABIT LOOP + DAILY RETURN ENGINE STRONG PARTIAL ACCOMPLISHED

The daily return engine is implemented and instrumented. Full accomplishment is not claimed because elapsed production cohorts must still prove D2 retention > 10%, D7 retention > 6%, 2+ active-day rate > 15%, notification usefulness > 55%, and alert-return conversion > 12%.

## Implementation Summary

- Added an explicit Daily Setup Card to the Terminal command center.
- Added concrete return reasons:
  - watchlist symbols moved
  - alert triggered
  - new opportunities detected
  - market memory updated
  - AI confidence changed
  - macro risk changed
  - missed opportunities
- Added daily workflow tasks:
  - Morning Briefing
  - Watchlist Review
  - Market Opportunities
  - Alert Follow-up
  - Symbol Follow-up
  - Performance Review
  - Replay Review
  - Market Memory Updates
- Added habit metric contracts for DAU, WAU, MAU, return sessions, watchlist returns, alert returns, briefing returns, replay returns, compare returns, and symbol returns.
- Expanded notification context so each drawer card explains:
  - Why
  - What changed
  - Why it matters
  - What to do next
- Expanded notification quality telemetry:
  - opened
  - ignored
  - converted
  - useful
  - not useful
  - fatigue signal
- Added `briefing_return` and `symbol_return` analytics events so daily briefing and symbol research are separated from generic route traffic.
- Expanded admin analytics to expose MAU, briefing returns, symbol returns, and notification opened/ignored/converted counts.

## Changed Files

- `frontend/src/lib/trading/daily-driver-retention.ts`
- `frontend/src/lib/trading/daily-driver-retention.test.ts`
- `frontend/src/components/terminal/DailyDriverRetentionPanel.tsx`
- `frontend/src/components/notifications/NotificationBell.tsx`
- `frontend/src/lib/client/analytics.ts`
- `frontend/src/lib/server/analytics.ts`
- `frontend/src/lib/analytics-policy.ts`
- `frontend/src/components/admin/AnalyticsDashboard.tsx`

## Trust Boundary

- No fake retention events were seeded.
- No synthetic users were created.
- Same-day activity is not counted as D2 or D7.
- Notification conversion is recorded only when a user opens a notification action URL.
- Ignored notification tracking is based on unread visible notifications remaining when the drawer is dismissed.
- The product implementation is live immediately, but retention success requires elapsed production cohort evidence.

## Local Validation

Passed locally:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

## Production Deployment

Pending:

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Pull: `git pull --ff-only origin main`
- Rebuild: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`

## Retention Proof

Pending post-deploy cohort export.

## Habit Loop Report

The Terminal now presents a single daily setup surface before the user falls into generic browsing. The card promotes one top return reason plus eight daily workflow tasks. The model stays evidence-bound: return reasons use watchlist evolution, trigger monitors, scanner rows, replay candidates, and workflow evolution; missing evidence remains `partial` or `blocked`.

## Notification Quality Report

The notification drawer now distinguishes drawer opens, action conversions, ignored unread notifications, explicit useful/not-useful feedback, and fatigue signals. Notification copy includes Why / Changed / Matters / Next so a generic notification cannot satisfy the UI contract.

## Remaining Blockers

- Real elapsed cohorts still need to prove the retention targets.
- Founding/paid cohorts must produce meaningful alert-return and notification usefulness sample sizes.
- Notification quality improvements need post-release behavior data before they can be certified as successful.
