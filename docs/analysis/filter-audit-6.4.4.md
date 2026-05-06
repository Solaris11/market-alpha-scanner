# Phase 6.4.4 Filter Reliability Audit

Date: 2026-05-06

Scope: product-wide filter, search, sort, range, date, tab, and chart-timeframe controls. Scanner scoring and scanner execution are out of scope.

## Filter Contract

Every filter surface must keep one filtered dataset as the source of truth for cards, charts, tables, result counts, selected rows, and empty states. Active filter state must be visible. Reset behavior must be explicit. Date parsing must be deterministic UTC parsing, not browser-local parsing.

## Inventory

| Page / Component | Control Type | Source Dataset | State Owner | Expected Behavior | Status |
| --- | --- | --- | --- | --- | --- |
| History / `HistoryWorkspace` | symbol search, quick range, From UTC, To UTC, sort headers, insight tabs | `/api/history/symbol/[symbol]` rows | client component | Range/date filters drive metric cards, charts, tabs, timeline, counts, selected chart point reset, empty state | Fixed and test-covered |
| History / `TrendChart` | hover/tap selected point | filtered history rows | chart component | Tooltip and selected panel bind to exact filtered observation | Pass |
| Opportunities / `OpportunitiesWorkspace` | tabs, search, decision, asset, sector, setup, score, conviction, entry, quality, watchlist, sort | scanner opportunity rows | client component | Filtered rows drive count and cards; active filters visible; reset available | Hardened |
| Terminal / right rail modules | no user filters; clickable symbol references | latest scanner rows | server/client page data | No filtered user state | Pass |
| Performance / `PerformanceDrift` | symbol/company search, upgrades, score gainers, min score change, sort, selected row | intraday drift rows | client component | Filtered rows drive table/count; selected row clears when filtered out | Hardened |
| Performance / `AutoCalibrationRecommendations` | recommendation, group, horizon, min confidence, sort | calibration recommendation rows | client component | Filtered rows drive simple cards, table, count; active filters visible; reset available | Hardened |
| Alerts / `AlertsWorkspace` | alert creation selectors, rule entry-filter selector, enabled toggles | alert rules/state | client component + API | Rule controls mutate explicit DB-backed rule state; table sorted enabled-first | Pass |
| Admin Monitoring | time range links, synthetic check selector, route drilldown | monitoring DB aggregates | server range + client drilldown | Query range updates charts/cards/routes; selected check changes synthetic series | Pass |
| Admin Support | status filter | support tickets | server query param | Status filter constrains queue and empty state | Pass |
| Support Tickets | no queue filters | current-user tickets | server page | No filtered user state | Pass |
| Symbol detail / `MiniPriceContextChart` | 1D/1W/1M/6M/1Y timeframe | symbol price candles | client component | Timeframe constrains candles; fallback range visible | Pass |
| Symbol detail / `PriceHistoryChart` | 1D/1W/1M/6M/YTD/1Y/5Y/Max period | `/api/price-history/[symbol]` | client component | Period refetches rows, cards and chart update, UTC labels, pointer tooltip works on touch | Hardened |
| Account | no data filters | current account state | server/client page | No filtered user state | Pass |

## Root Causes Found

1. History date parsing accepted impossible dates because `Date.UTC` normalized them. Example: `2026-02-31` could roll into March instead of failing.
2. History `To` values from minute-precision `datetime-local` fields were inclusive only at `:00.000`, which could exclude observations later in the selected minute.
3. History filter state was not exposed as a single diagnostic object, making real UI validation harder than it should be.
4. Performance selected-symbol detail could remain visible after filters removed that symbol from the filtered set.
5. Opportunities and calibration filters had counts but no explicit active-filter count or reset control.
6. Price-history chart date labels used browser-local formatting. That made chart labels nondeterministic across devices.

## Fixes Implemented

- Added deterministic History filter diagnostics with `historyFilterResult`.
- Made History reject invalid and inverted custom ranges.
- Made History `To UTC` minute selection inclusive through the selected minute.
- Added visible History active-filter summary, count, invalid-range message, and reset controls.
- Added test hooks for History filter count, summary, empty state, and chart point counts.
- Reset Performance selected symbol detail when filtered out.
- Added active-filter summaries and reset controls to Opportunities, Performance, and Auto Calibration.
- Changed price-history chart axis/tooltip formatting to UTC and pointer events for touch support.

## Remaining Risks

- Production history may not span enough days for range changes to be visually obvious, so browser validation must use deterministic seeded route fixtures in addition to live data.
- Some admin/server-side filters are query-param based and should be rechecked after future pagination changes.
- Alert rule controls are mutation controls more than filters; they are intentionally not refactored in this phase.
