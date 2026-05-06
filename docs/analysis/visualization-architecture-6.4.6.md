# Phase 6.4.6 Visualization Architecture Audit

Date: 2026-05-06

## Decision

Marketora now uses a hybrid visualization model:

- Keep the existing trading-style time-series layer for price, score, candle, and symbol-detail charts.
- Add Apache ECharts for dashboard intelligence, distributions, monitoring, and operational analytics.

This keeps high-frequency symbol charts lightweight while making dashboard intelligence feel more like an institutional observability and market-intelligence surface.

## Visualization Inventory

| Surface | Current Purpose | Current/Target Library | Recommendation | Risk / Complexity |
| --- | --- | --- | --- | --- |
| Terminal cross-asset price/context cards | Compact symbol context | Existing cards + ECharts summary distributions | Add ECharts decision/setup/confidence summaries; keep symbol charts unchanged | Low |
| Terminal symbol mini charts | Price/candle context | Lightweight Charts | Keep | Low |
| Opportunities setup intelligence | Setup, decision, confidence distribution | ECharts | Add bar/donut distribution charts backed by latest scan rows | Low |
| Opportunities top setup mini price context | Trading-style price context | Lightweight Charts | Keep | Low |
| Performance validation | Evidence and forward-return summaries | Existing compact bars | Candidate for later ECharts migration once sample size grows | Medium |
| History score/price charts | Filtered symbol time series | Existing deterministic SVG/time-series | Keep for now; filter accuracy was recently validated | Medium if rewritten |
| Symbol detail price charts | Candles, support/resistance, context levels | Lightweight Charts | Keep | Low |
| Admin monitoring | Ops time-series, route latency, synthetics, backup events | ECharts | Replace custom SVG time-series with ECharts line/area charts | Low |
| Admin calibration | Buckets, setup performance, evidence maturity | Tables/cards | Candidate for ECharts once enough forward-return history exists | Medium |
| Paper trading PnL | Simple account-equity trend | Existing SVG | Candidate for later ECharts if paper trading becomes a primary workflow | Low |
| Alerts/watchlists | Lists and status summaries | Cards/tables | No chart migration needed yet | Low |

## Changes Implemented

1. Added a reusable `PremiumEChart` client wrapper with dynamic ECharts loading, resize observation, and dark panel framing.
2. Added shared option builders for:
   - premium time-series line/area charts
   - distribution bar charts
   - donut charts
3. Upgraded `/admin/monitoring` time-series charts to ECharts without changing the underlying monitoring queries.
4. Added ECharts setup, decision, and confidence intelligence charts to `/opportunities`.
5. Added ECharts decision/setup/confidence pulse charts to `/terminal`.

## Surfaces Intentionally Not Rewritten

The following remain on the existing lightweight/trading chart layer:

- `/symbol/[symbol]` price/candle context
- mini price context charts
- `/history` score and price charts
- compact symbol time-series visuals

These charts are already interaction-specific, recently stabilized, and better served by a lightweight renderer than by a broad dashboard chart library.

## Design Guardrails

- Dark premium palette, restrained glow, no rainbow dashboards.
- Legends and tooltips must expose exact values without visual clutter.
- Empty states remain honest; no fake chart data is generated.
- Charts are responsive and dynamically loaded to avoid server-side rendering instability.

## Remaining Visualization Debt

1. Calibration dashboard should receive ECharts once forward-return samples become statistically meaningful.
2. Performance validation could use ECharts for expectancy and evidence maturity distributions.
3. History charts should stay on the deterministic filtered dataset, but can later share legend styling with the ECharts system.
4. Bundle impact should be watched after real beta traffic; ECharts is dynamically imported by the chart wrapper but still adds dependency weight.
