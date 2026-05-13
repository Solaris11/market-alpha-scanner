# Phase 14.4 - Mobile Intelligence OS

## Summary

TradeVeto's mobile surfaces now behave more like a native intelligence app instead of a compressed desktop dashboard. The work focused on navigation speed, swipeable overview cards, bottom-sheet detail behavior, chart readability, and mobile-safe progressive disclosure.

## Mobile Navigation

- Replaced the old mobile bottom nav mix with primary beta workflows: Terminal, Opportunities, Watch, Alerts, Find, and More.
- Kept Account inside the drawer so the bottom rail stays focused on frequent market workflows.
- Added explicit Watch and Find nav items with dedicated icons and touch-sized hit targets.
- Preserved the existing mobile drawer for full navigation and account actions.

## Swipeable Intelligence Cards

- Converted the interactive intelligence zone grid into a horizontal snap carousel on mobile.
- Zones remain normal responsive grids on tablet and desktop.
- The swipeable model applies to Market State, Best Setups, Shock Watch, Dangerous Now, Watchlist Intelligence, What Changed, Risk Review, Volatility Pressure, Macro Pressure, and Replay Context.
- Mobile decision-inbox packets now use snap cards with shorter default text and details available through the linked workflow.
- Market Chart Hub cards now swipe horizontally on phones instead of stacking into a long dense list.

## Bottom Sheets

- Interactive intelligence zone details now open as mobile bottom sheets with a drag handle, safe-area padding, body scroll lock, and swipe-down close.
- Desktop keeps the centered modal behavior.
- Symbol and market chart expanded views now open as near-full-screen mobile sheets with larger chart area and larger timeframe controls.

## Mobile Chart Mode

- Interactive chart detail mode uses a taller mobile chart viewport with readable controls.
- Timeframe switches have larger mobile tap targets.
- Full chart detail views still show data source, last updated timestamp, interpretation, and limited-data states.
- No synthetic or seeded chart data was added.

## Performance Safety

- No new charting dependency was added.
- Changes use existing CSS, existing validated chart components, and existing data packets.
- Heavy chart rendering remains behind user interaction or existing chart components.
- Mobile horizontal scrolling uses CSS snap and hidden scrollbars without new JavaScript state.

## Validation

- `git diff --check`: passed
- `npm run lint`: passed
- `npm test -- --runInBand`: passed, 374 tests
- `npm run build`: passed
- `npm audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors

## Production Deployment And Smoke

- Local commit `ad4b28871198cc5e295bfa3cbdbb1992f84e0f04` was pushed to `origin/main`.
- Production host `onsre-node-01` pulled `origin/main` in `/opt/apps/market-alpha-scanner/app`.
- Rebuilt and restarted `market-alpha-frontend` with `docker compose up -d --build market-alpha-frontend`.
- `market-alpha-frontend` and `market-alpha-postgres` reported healthy.
- `/api/health` returned `ok: true`.
- `/api/health/deep` returned DB ok, scanner ok, local backup ok, and R2/offsite backup ok.

Production route smoke after deploy:

| Route | Status | Latency |
| --- | ---: | ---: |
| `/` | 200 | 286 ms |
| `/terminal` | 200 | 141 ms |
| `/opportunities` | 200 | 133 ms |
| `/symbol/AMD` | 200 | 317 ms |
| `/performance` | 200 | 171 ms |
| `/history?symbol=AMD` | 200 | 163 ms |
| `/alerts` | 200 | 140 ms |
| `/paper` | 200 | 325 ms |
| `/dashboard` | 200 | 119 ms |
| `/mobile` | 200 | 194 ms |
| `/manifest.webmanifest` | 200 | 93 ms |
| `/tradeveto-sw.js` | 200 | 138 ms |
| `/icon-192.png` | 200 | 146 ms |
| `/icon-512.png` | 200 | 262 ms |
| `/api/push/status` | 401 | 133 ms |

The `401` on `/api/push/status` is expected for unauthenticated smoke testing; it confirms the route fails closed instead of 404ing.

Local Chromium screenshots against production were captured for:

- iPhone-sized `/mobile`
- Android-sized `/terminal`
- Landscape `/mobile`

## Remaining Mobile Debt

- Real-device QA should still be done on iPhone Safari, Android Chrome, and Facebook in-app browser after production deploy.
- Some deeper pages still have dense advanced sections, but the primary mobile paths now favor overview, swipe, tap, and drilldown.
- Future work can add true swipe-to-close behavior to chart sheets; intelligence detail sheets already support swipe-down close.

Final status: MOBILE INTELLIGENCE OS COMPLETE
