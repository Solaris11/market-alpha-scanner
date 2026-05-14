# Phase 14.10 UX Debt Fix + 95 Polish

Date: 2026-05-14

## Executive Summary

Phase 14.10 focused on beta-reported UX debt rather than new intelligence features. The main fixes were shared detail placement, mobile/desktop navigation cleanup, clearer alert/watch actions, compact price context on opportunity and watchlist cards, and removal of internal engineering language from normal user surfaces.

Final status: local validation passed; production was redeployed from Git and production smoke/authenticated QA passed.

Production deployment:

- Host: `onsre-node-01`
- User: `sre`
- App path: `/opt/apps/market-alpha-scanner/app`
- Commit deployed: `4617ab49307fcf7f59b8701db3e1f8d41eadd0be`
- Docker service rebuilt: `market-alpha-frontend`
- Container health: healthy
- `/api/health`: 200, `ok: true`
- `/api/health/deep`: 200, DB/scanner/local backup/R2 backup all `ok`

## Issues Fixed

- Replaced offscreen right-side detail drawers with a shared centered overlay so clickable intelligence zones and charts open visibly on desktop and mobile.
- Preserved scroll position when opening/closing detail views and added ESC/backdrop/X close behavior through one shared primitive.
- Removed duplicate mobile navigation row and simplified primary navigation to Terminal, Opportunities, Watchlist, Alerts, and Dashboard.
- Updated the More drawer grouping to separate primary workflows, research surfaces, and support/account utilities.
- Added visible feedback to watchlist toggles so Watch actions no longer silently do nothing.
- Fixed watched-symbol quick alert buttons to save/update rules and show success/error status.
- Added compact real-data price context to opportunity cards and watchlist previews: latest/last close, entry zone, invalidation, target, and freshness labels where available.
- Added user-facing "How to use this page" guidance to Performance, History, and Paper Trading.
- Cleaned user-facing language on Performance, Mobile App Setup, Strategy Labs, support, FAQ, How It Works, and public strategy pages.
- Replaced internal phrases such as forward-return observations, lifecycle proof, VAPID, wrapper/signing workflow, and deterministic packet with user-facing language.

## Components Changed

- `frontend/src/components/ui/StableDetailOverlay.tsx`
- `frontend/src/components/visual/InteractiveVisualIntelligence.tsx`
- `frontend/src/components/charts/InteractivePriceChart.tsx`
- `frontend/src/components/terminal/TerminalShell.tsx`
- `frontend/src/components/terminal/TerminalNav.tsx`
- `frontend/src/lib/navigation.ts`
- `frontend/src/components/watchlist-controls.tsx`
- `frontend/src/components/alerts/alerts-workspace.tsx`
- `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx`
- `frontend/src/components/terminal/MyWatchlistWidget.tsx`
- `frontend/src/app/performance/page.tsx`
- `frontend/src/app/history/page.tsx`
- `frontend/src/app/paper/page.tsx`
- `frontend/src/app/mobile/page.tsx`

## Desktop QA Notes

- Detail views now open centered in the visible viewport instead of offscreen.
- X close and backdrop close are available.
- Page body is locked while the detail is open and scroll position is restored on close.
- Terminal remains the primary cockpit; low-frequency routes are moved to the More drawer.

## Mobile QA Notes

- Duplicate mobile nav was removed.
- Main bottom navigation stays limited to five primary destinations plus More.
- Centered detail overlays fit the viewport and keep close controls visible.
- Mobile App Setup copy now explains install and push behavior in plain language.

## Authenticated QA Notes

- Watchlist toggle now provides immediate user feedback for add/remove/duplicate-like interactions.
- Quick alert presets now call the alert rules API and show saved/updated/error status.
- Disposable invite-beta QA user was created through the production register flow, received beta premium entitlement, accepted legal docs, saved AMD to watchlist, created an alert rule, saved notification preferences, saved workspace preferences, and was then deleted.
- Cleanup result: 1 user row deleted; 0 rows remained for the disposable QA email.
- No billing code or entitlement logic was changed.

## Routes Tested

Local build route coverage included:

- `/`
- `/terminal`
- `/dashboard`
- `/opportunities`
- `/symbol/[symbol]`
- `/performance`
- `/history`
- `/paper`
- `/strategy-labs`
- `/alerts`
- `/mobile`
- `/api/health`
- `/api/health/deep`

Production smoke after deploy covered:

- `/`: 200
- `/terminal`: 200
- `/dashboard`: 200
- `/opportunities`: 200
- `/symbol/AMD`: 200
- `/performance`: 200
- `/history?symbol=AMD`: 200
- `/paper`: 200
- `/strategy-labs`: 200
- `/alerts`: 200
- `/mobile`: 200
- `/api/health`: 200
- `/api/health/deep`: 200

## Validation Results

- `npm run lint`: passed
- `npm test -- --runInBand`: passed, 390 tests
- `npm run build`: passed
- `npm audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed
- Production authenticated QA: passed

## Remaining UX Debt

- Full authenticated browser QA should continue with real beta users because local watchlist storage, server watchlist persistence, alert channel configuration, and notification delivery can vary by account.
- Some advanced tables remain dense by design; they are now hidden behind details but should be observed during beta.
- Dashboard/Terminal distinction should continue to be measured with user behavior analytics.

## Final Score Estimate

- Desktop UX: 94-95
- Mobile UX: 93-95
- Interaction UX: 95
- User clarity: 94-95
- Visual polish: 94
- Product trust: 95
