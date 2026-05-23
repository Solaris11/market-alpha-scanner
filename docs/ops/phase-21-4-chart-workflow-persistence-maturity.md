# Phase 21.4 - Chart Workflow Persistence + Professional Maturity

Date: 2026-05-23

## Scope

Phase 21.4 targets chart workflow persistence and mature chart operations without faking unsupported trading-platform features.

## Implemented

- Persistent drawings remain stored per symbol and are now bounded consistently at 24 drawings.
- Drawing edit mode is functional: select, drag, nudge, duplicate, delete, and clear are available from the chart toolbar and keyboard.
- Indicator, overlay, timeframe, fullscreen, detail-mode, and layout choices persist in the chart workspace payload.
- Fullscreen chart state is persisted and restored only for full chart surfaces, not compact mini-chart embeds.
- Multi-chart fullscreen layouts persist through the existing focus, split, grid, and stack layout modes.
- Cross-device chart sync is backed by authenticated database storage through `user_workspace_preferences.chart_workspaces`.
- The new `/api/user/chart-workspaces/[symbol]` route reads and writes one symbol workspace without overwriting unrelated workspace preferences.
- Multi-pane fullscreen charts now synchronize crosshair position through the Lightweight Charts API when split, grid, or stack mode is active.
- Account sync preserves `updatedAt` during hydration so stale local storage does not incorrectly override newer server chart state.

## Database

- Added migration: `db/migrations/20260523_120000_chart_workflow_persistence.sql`
- Adds `user_workspace_preferences.chart_workspaces JSONB NOT NULL DEFAULT '{}'::jsonb`
- Adds GIN index: `ix_user_workspace_preferences_chart_workspaces_gin`

## Local Validation

- `npm --prefix frontend run lint`: passed
- `npm --prefix frontend test -- --runInBand`: passed, 478 tests
- `npm --prefix frontend run build`: passed
- `npm --prefix frontend audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors / 0 warnings
- `git diff --check`: passed

## Local Browser Smoke

- Local dev server: `http://192.168.0.31:3000`
- `/symbol/AMD`: HTTP 200, evidence-limited local data state, no application error
- `/terminal`: HTTP 200, evidence-limited local data state, no application error
- `/api/user/chart-workspaces/AMD`: HTTP 200 unauthenticated fallback, `{ authenticated: false, symbol: "AMD", workspace: null }`

Local browser smoke could not visually exercise a live chart because the local scanner database output is unavailable in this environment.

## Production Proof

- Git deployed commit: `7eaad07`
- Production pull: fast-forwarded from `524d795` to `7eaad07`
- Production migration: `20260523_120000_chart_workflow_persistence.sql` applied, 43 previous migrations skipped
- Production database proof: `user_workspace_preferences.chart_workspaces` exists as `jsonb`
- Production Docker build: passed
- Production frontend redeploy: `market-alpha-frontend` recreated and healthy
- Production route list includes `/api/user/chart-workspaces/[symbol]` in the Next.js build output

### Production Route Smoke

- `https://tradeveto.com/api/health`: HTTP 200, 0.150s
- `https://tradeveto.com/api/health/deep`: HTTP 200, 0.157s
- `https://tradeveto.com/api/user/chart-workspaces/AMD`: HTTP 200 unauthenticated fallback
- `https://tradeveto.com/terminal`: HTTP 200, 0.376s
- `https://tradeveto.com/symbol/AMD`: HTTP 200, 0.354s
- `https://tradeveto.com/scanner`: HTTP 200, 0.118s
- `https://tradeveto.com/discover`: HTTP 200, 0.122s
- `https://tradeveto.com/paper`: HTTP 200, 0.601s
- `https://tradeveto.com/strategy-labs`: HTTP 200, 0.466s
- `https://tradeveto.com/market-memory`: HTTP 200, 1.865s
- `https://tradeveto.com/feed`: HTTP 200, 1.071s
- `https://tradeveto.com/macro`: HTTP 200, 0.601s
- `https://tradeveto.com/performance`: HTTP 200, 0.544s

### Authenticated Chart Workspace Proof

Temporary authenticated proof user was created directly in production, used for chart workspace API verification, and deleted after the proof.

- `GET /api/auth/me`: HTTP 200, authenticated `true`
- `GET /api/auth/csrf`: HTTP 200, CSRF token present
- `PUT /api/user/chart-workspaces/AMD`: HTTP 200, authenticated `true`
- PUT workspace returned `period=1y`, `layoutMode=grid`, `drawingTool=edit`, `drawingCount=1`
- `GET /api/user/chart-workspaces/AMD`: HTTP 200, authenticated `true`
- GET workspace returned `period=1y`, `layoutMode=grid`, `drawingTool=edit`, `drawingCount=1`

### Production Browser Smoke

- Public `/symbol/AMD` loaded without application errors.
- Public chart controls were not visible because the unauthenticated public symbol route exposes public-safe intelligence and hides premium chart detail.
- Authenticated chart workspace persistence was therefore proven through the authenticated production API path above.

## Remaining Limits

- Advanced drawing alerts are not implemented.
- Full trading-platform object editing such as text labels, style editing, snapping, and coordinate/time-price anchoring is not claimed.
- Crosshair sync is implemented for TradeVeto fullscreen multi-pane chart layouts, not across separate browser tabs.
