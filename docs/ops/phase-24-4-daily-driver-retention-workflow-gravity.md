# Phase 24.4 - Daily-Driver Retention + Workflow Gravity

Date: 2026-05-24

Verdict: STRONG PARTIAL ACCOMPLISHED

## Scope

Phase 24.4 focused on making TradeVeto more habit-forming without claiming retention success before elapsed production cohorts prove it. The runtime work strengthens the Terminal daily-driver system, adds explicit morning completion telemetry, surfaces changed-since-last-session intelligence, and makes retention proof gates visible in the product and admin analytics.

## Implemented

- Expanded the Terminal Daily Driver panel from a narrow retention prompt into a broader morning command workflow:
  - overnight market summary
  - overnight event summary
  - watchlist movement
  - scanner changes
  - risk changes
  - macro updates
  - AI intelligence digest
- Added local daily habit completion UX:
  - explicit "Complete briefing" action
  - local same-day completion state
  - local streak memory
  - `morning_workflow_complete` analytics event
  - `workflow_continuity` event emitted on completion
- Added adaptive return priorities:
  - adaptive feed
  - adaptive scanner
  - adaptive macro priorities
  - preferred workflow ranking
  - preferred asset ranking
- Added changed-since-last-session cards:
  - watchlist changes
  - improving/deteriorating setup changes
  - trigger monitors
  - first-session baseline fallback
- Added visible retention proof gates:
  - D2 retention target > 10%
  - D7 retention target > 6%
  - 2+ active-day target > 15%
  - notification useful ratio target > 65%
  - alert-return conversion target > 15%
- Added admin analytics support for `morning_workflow_complete`.
- Preserved the no-overclaim rule in the model proof boundary and blocker text.

## Files Changed

- `frontend/src/lib/trading/daily-driver-retention.ts`
- `frontend/src/components/terminal/DailyDriverRetentionPanel.tsx`
- `frontend/src/lib/analytics-policy.ts`
- `frontend/src/lib/server/analytics.ts`
- `frontend/src/components/admin/AnalyticsDashboard.tsx`
- `frontend/src/lib/trading/daily-driver-retention.test.ts`
- `frontend/src/lib/analytics-policy.test.ts`

## Validation

Local validation completed:

- `npm --prefix frontend run lint` - passed
- `npm --prefix frontend test -- --runInBand` - passed, 498 tests
- `npm --prefix frontend run build` - passed
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings
- `git diff --check` - passed

Focused test coverage:

- `daily-driver-retention.test.ts` verifies the expanded morning workflow, retention targets, change visualization, adaptive priorities, and telemetry proof signals.
- `analytics-policy.test.ts` verifies `morning_workflow_complete` is accepted by the analytics allowlist.

## Production Deployment Proof

- Runtime commit deployed: `b72c5484`
- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- `git pull --ff-only origin main` - passed, fast-forwarded from `894c8c4` to `b72c548`
- `docker compose --env-file .env up -d --build market-alpha-frontend` - passed
- Production container status: `market-alpha-frontend Up ... (healthy)`

Production smoke:

- `https://tradeveto.com/api/health` - passed, `ok: true`
- `https://tradeveto.com/api/health/deep` - passed, `ok: true`
- `/terminal` - 200
- `/feed` - 200
- `/discover` - 200
- `/history` - 200
- `/alerts` - 200
- `/strategy-labs` - 200

## Production Retention Evidence

Production analytics query window: last 30 days for loop/depth metrics, 120-day actor-day source for cohort eligibility.

| Metric | Current Production Evidence | Target | Status |
| --- | ---: | ---: | --- |
| D1 retention | 7 / 903 = 0.78% | reference | weak |
| D2 retention | 3 / 839 = 0.36% | > 10% | failed |
| D7 retention | 1 / 443 = 0.23% | > 6% | failed |
| 2+ active-day retention | 9 / 903 = 1.00% | > 15% | failed |
| Return sessions | 1 | increasing | weak |
| Morning workflow starts | 2 | increasing | weak |
| Morning workflow completions | 0 | increasing | new event, no elapsed proof yet |
| Scanner returns | 0 | increasing | weak |
| Watchlist returns | 1 | increasing | weak |
| Alert returns | 0 | > 15% conversion | failed |
| Notification useful feedback | 0 useful / 0 not useful | > 65% useful | no proof |

These metrics do not support a full retention accomplishment claim.

## Competitor Gap Status

- Robinhood still leads on habit loops through account state, portfolio movement, daily push behavior, and low-friction repeat visits.
- TradingView still leads on chart-community workflow gravity, saved layouts, alerts, and cross-device chart habits.
- Apple Stocks still leads on passive daily glance behavior, lightweight watchlist continuity, and notification familiarity.

TradeVeto narrowed the workflow-continuity gap by making the morning command flow, changed-since-last-session memory, adaptive priorities, and completion telemetry visible and actionable. It has not yet proven repeat-use behavior at the target levels.

## Remaining Blockers

- D2 retention is still far below the > 10% target.
- D7 retention is still far below the > 6% target.
- 2+ active-day retention is still far below the > 15% target.
- Notification usefulness has no production feedback sample in the current window.
- Alert-return conversion remains unproven.
- Morning completion telemetry is newly deployed and has no elapsed production cohort evidence yet.
- Full certification requires real users to return over elapsed days after this workflow is live.

## Final Verdict Rationale

Strong partial is justified because the runtime workflow gravity system, telemetry, admin visibility, production deployment, and production smoke are complete. Full accomplishment is not defensible because production retention cohorts still miss every stated retention target.

