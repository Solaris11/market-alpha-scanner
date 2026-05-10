# Phase 11.7 Performance Budget + Query Profiling

This pass hardens TradeVeto performance for larger beta traffic without changing scanner scoring or market-intelligence methodology.

## Route Budgets

The controlled-beta route budget catalog is defined in `frontend/src/lib/performance-budget.ts`.

Current budgets:

- `/api/health`: 750ms
- `/api/health/deep`: 1500ms
- `/terminal`: 3500ms
- `/dashboard`: 3500ms
- `/opportunities`: 3500ms
- `/symbol/AMD`: 4000ms
- `/paper`: 3500ms
- `/strategy-labs`: 3500ms
- `/community`: 3000ms
- `/developers`: 3000ms
- `/history`: 3000ms
- replay APIs: 2000ms
- v1 developer feeds: 1500-2000ms

Run:

```bash
tools/ops/tradeveto-performance-budget-check.sh
```

Use `TRADEVETO_PERFORMANCE_BASE_URL=http://localhost:3000` to profile a local production server.

For local production-server checks without a configured DB, use:

```bash
TRADEVETO_PERFORMANCE_BASE_URL=http://127.0.0.1:3020 \
TRADEVETO_PERFORMANCE_ALLOW_404=false \
TRADEVETO_PERFORMANCE_ALLOW_DEGRADED_HEALTH=true \
tools/ops/tradeveto-performance-budget-check.sh
```

## Profiling Findings

The expensive surfaces were not single slow UI components. They were repeated server-side data loads and repeated derived-intelligence construction:

- `/terminal` loaded scanner rows, scan safety, market regime, top candidates, performance evidence, shock patterns, narratives, workflow evolution, intraday drift, paper data, portfolio intelligence, live intelligence, strategy intelligence, and scenario intelligence.
- `/dashboard`, `/opportunities`, `/paper`, and `/strategy-labs` repeatedly rebuilt the same opportunity model from scanner rows, forward-return evidence, shock patterns, and narratives.
- `/symbol/[symbol]` loaded the full scanner universe, symbol detail, price history, scan safety, forward returns, shock memory, narrative, market memory, workflow evolution, and intraday drift.
- `/developers` now has bounded API key, webhook, delivery, and 7-day usage summary queries.
- Replay and heatmap surfaces remain bounded by recent runs, current universe rows, and explicit limits.

## Optimizations Applied

- Added request-scope caching for scanner DB reads:
  - latest successful scan run
  - latest full ranking
  - top candidates
  - scan data health
  - history summary
  - historical scanner rows
  - latest symbol summary
  - forward-return performance reads
  - recent intraday drift history
  - symbol price history
- Reduced duplicate terminal loading by deriving terminal market regime from the already-loaded scanner rows instead of loading the full ranking a second time.
- Added a route budget utility and tests so performance expectations are executable, not just documentation.
- Added an operator route timing script that records HTTP status, total latency, TTFB, payload size, and budget result.

## Validation Snapshot

Production route budget check on 2026-05-10:

- `/api/health`: 156ms
- `/api/health/deep`: 258ms
- `/terminal`: 212ms
- `/dashboard`: 127ms
- `/opportunities`: 198ms
- `/symbol/AMD`: 255ms
- `/paper`: 129ms
- `/history`: 147ms
- `/api/history/replay?symbol=AMD`: 145ms with expected unauthenticated `401`

Local production build check on 2026-05-10:

- `/terminal`: 100ms
- `/dashboard`: 17ms
- `/opportunities`: 22ms
- `/symbol/AMD`: 44ms
- `/strategy-labs`: 11ms
- `/community`: 12ms
- `/developers`: 14ms

Local API v1 calls returned fast `429` responses because the local production server was started without `DATABASE_URL`, so the rate limiter failed closed as designed.

## Slow Query Watchlist

These remain the main query surfaces to watch as beta traffic grows:

- `scanner_signals` joined to latest `scan_runs` for full-universe ranking.
- `forward_returns` tail reads used by calibration, strategy, shock, and simulated portfolio surfaces.
- `scanner_signals` joined to recent `scan_runs` for intraday drift.
- `symbol_price_history` ordered full history for symbol detail charts.
- `narrative_intelligence_snapshots DISTINCT ON (symbol)` for full-universe narrative hydration.
- `shock_move_patterns WHERE symbol = ANY(...)` for full-universe shock hydration.
- developer usage aggregation over `developer_api_usage_hourly` for the developer console.

## Remaining Bottlenecks

- Current route timing script profiles unauthenticated or locked states unless run with a browser/session-aware harness.
- Page-level server render timings are not yet written to `request_metrics`; API routes are covered by `withRequestMetrics`.
- Heatmap and replay UI payload size should be monitored after real premium-user traffic expands.
- Strategy Labs and paper analytics still do several CPU-side derived-model builds after data loading. This is bounded, but should move to precomputed summaries if traffic grows materially.
- Production route timing for developer API v1 depends on deploy status; current checks allow `404` while routes are not yet deployed.

## Current Score

Controlled-public-beta performance budget score estimate: **91/100**.

To move above 95:

- Add authenticated browser timing checks for premium pages.
- Record page-level render timings, not only API timings.
- Add DB `EXPLAIN ANALYZE` snapshots for the slow-query watchlist in staging.
- Precompute terminal/dashboard opportunity-model summaries every scan cycle.
- Add payload-size budgets for heatmaps, replay, and symbol detail JSON.
