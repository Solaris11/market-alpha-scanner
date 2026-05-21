# Phase 19.4 - Chart Workflow Gap Closure

Date: 2026-05-21

## Result

Phase 19.4 closes the highest-impact chart workflow gaps that were still realistic inside TradeVeto's intelligence-native chart model. The work does not attempt to clone TradingView. It makes TradeVeto charts more persistent, keyboard-operable, annotation-friendly, fullscreen-ready, and synchronized across embedded, expanded, and global market chart contexts.

Final status:

TRADEVETO CHART WORKFLOW GAP CLOSURE ACCOMPLISHED

## Implemented

| Requirement | Status | Implementation |
| --- | --- | --- |
| Drawing tools | Improved | Added persistent client-side research drawings and a measurement ruler alongside inspect, trendline, range, and marker tools |
| Indicator management | Preserved | EMA 20, EMA 50, and Range Pressure remain managed from validated candle data only |
| Persistent chart layouts | Implemented | Per-symbol chart workspace state is stored locally with strict sanitization |
| Multi-chart workflows | Improved | Fullscreen focus, split, and stack layouts now persist by symbol |
| Compare mode persistence | Implemented | Fullscreen compare/overlay/timeline mode is persisted by symbol |
| Synchronized overlays | Improved | Overlay family selections persist and synchronize across embedded/fullscreen chart panes |
| Replay/macro/risk/memory overlays | Preserved | Existing overlay families remain data-backed and are not drawn without source markers |
| Fullscreen workflows | Improved | Expanded chart detail remembers timeframe, layout, overlays, indicators, and mode |
| Mobile fullscreen chart UX | Improved | State persists across expanded market and symbol chart usage; mobile-safe controls remain touch-sized |
| Keyboard shortcuts | Implemented | Focused symbol charts support keyboard-driven timeframe, fullscreen, reset, and drawing-tool cycling; expanded charts support mode/layout/timeframe control |
| Chart storytelling | Preserved | Workflow dock and story panels continue to explain why overlays and chart states matter |

## Storage Architecture

Added:

- `frontend/src/components/terminal/chart-workflow-storage.ts`
- `frontend/src/components/terminal/chart-workflow-storage.test.ts`

Persisted per symbol:

- selected timeframe
- overlay families
- managed indicators
- drawing tool
- saved research drawings
- fullscreen detail mode
- fullscreen layout mode
- last updated timestamp

The storage layer sanitizes all restored state before it can affect rendering:

- unsupported periods are rejected
- unsupported indicators are rejected
- unsupported overlay families are rejected
- duplicate indicator/overlay entries are deduped
- drawing coordinates are clamped to chart bounds
- stored drawings are capped to the latest 24
- invalid JSON or unavailable local storage degrades to session defaults

## Data Rules

No fake chart intelligence was added.

- Drawings are user-created local research annotations only.
- Drawings are not treated as TradeVeto evidence.
- Indicators are still derived from validated candle history only.
- Replay, macro, risk, memory, event, confidence, and level overlays still require real marker or level data.
- Global market chart timeframe persistence reuses the same sanitized workspace state without inventing price data.

## UX Changes

Updated:

- `frontend/src/components/terminal/SymbolChart.tsx`
- `frontend/src/components/charts/InteractivePriceChart.tsx`
- `frontend/src/components/ui/StableDetailOverlay.tsx`

User-facing improvements:

- chart workspaces no longer reset after route changes or chart expansion
- fullscreen compare/timeline/overlay mode is remembered
- fullscreen focus/split/stack layout is remembered
- symbol and global market charts remember selected timeframe
- annotations survive chart remounts in the browser session
- a ruler drawing supports quick visual measurement
- chart controls remain synchronized between fullscreen panes
- keyboard chart control is available when the chart is focused/active
- production mobile overlay scroll capture now refreshes when the trigger scroll position materially changes and rejects materially stale captured positions, preventing stale lock positions during dense mobile routes

## Validation

Local validation completed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 433 passed
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

Production validation was completed after deployment:

- production pull/rebuild/restart completed
- `market-alpha-frontend` container health: healthy
- `/api/health`: passed
- `/api/health/deep`: passed
- chart-relevant route smoke passed for `/terminal`, `/symbol/AMD`, `/dashboard`, `/macro`, `/market-memory`, `/discover`, `/scanner`, `/performance`, `/history?symbol=AMD`, `/mobile`
- production mobile emulation smoke passed

Production validation note:

- The first production mobile smoke after the chart deployment caught `/paper` overlay scroll drift. The root cause was stale stable-overlay trigger scroll capture after a route-level scroll-to-trigger operation. `StableDetailOverlay` now refreshes the captured trigger position when the scroll delta materially changes, then falls back to the current viewport position when a captured value is materially stale while preserving duplicate-event protection for normal pointer/click sequences.

## Remaining Chart Debt

TradeVeto is materially closer to professional chart workflow maturity, but it still should not be represented as a full TradingView replacement.

Remaining gaps:

- no custom scripting ecosystem
- no large indicator marketplace
- no full drawing-object editor with handles, magnet mode, or multi-point shapes
- no authenticated physical-device proof for premium chart workflows in this sprint
- true symbol-vs-symbol normalized price overlay remains limited by accessible chart packets
- chart-created alert rules are not implemented yet

The gap closed in this sprint is the TradeVeto-specific workflow gap: persistent intelligence-native chart workspaces, saved annotations, synchronized fullscreen state, global market chart continuity, and keyboard-operable chart exploration.
