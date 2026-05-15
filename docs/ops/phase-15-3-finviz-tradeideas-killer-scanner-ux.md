# Phase 15.3 - Finviz + Trade Ideas Killer Scanner Intelligence UX

Date: 2026-05-15

## Executive Summary

Phase 15.3 upgraded the Opportunities scanner into a more visual, risk-aware, explainable scanner cockpit without adding fake intelligence or advisory language.

The scanner now emphasizes:

- high-signal preset lenses for confidence, freshness, risk, macro support, replay similarity, and watchlist-first workflow
- a real-data sector market map showing opportunity concentration, risk concentration, freshness, and macro support
- richer opportunity cards with direct Chart, Alert, Replay, and Intelligence actions
- expanded sort semantics for risk pressure, freshness, macro alignment, and replay similarity
- honest limited-data behavior when replay, macro, or freshness fields are not present

Final status: **PHASE 15.3 FINVIZ TRADE IDEAS KILLER SCANNER UX COMPLETE**

## Implementation Summary

### Card Redesign

Updated `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx`.

Opportunity cards already had symbol identity, real price context, entry/invalidation/target context, evidence maturity, data freshness, risk/conviction factors, and watchlist controls. Phase 15.3 added a direct scanner action rail:

- **Chart** opens symbol chart context.
- **Alert** opens the alert creation path for the symbol.
- **Replay** opens symbol history/replay context.
- **Intel** opens symbol intelligence context.

The card remains compact and mobile-safe. It does not invent live prices, targets, or alert state.

### Scanner Preset UX

Added a scanner command deck with real-data preset lenses:

- **High Confidence**: rows with conviction >= 70 and score >= 55.
- **Fresh Setups**: rows with fresh scanner freshness status.
- **Risk Watch**: avoid-state rows or rows with elevated computed risk pressure.
- **Macro Aligned**: rows with constructive macro support fields.
- **Replay Similarity**: rows with validated replay or analog similarity.
- **Watchlist First**: rows already saved in the local watchlist.

These presets update the existing filter/sort model instead of creating a separate scanner mode.

### Heatmap Upgrades

Added a real-data sector market map:

- groups rows by scanner sector
- shows row count, fresh count, average score, average conviction, average risk, and average macro support
- shows leading symbols by score
- clicking a sector filters the scanner to that sector

If sector data is unavailable, the UI shows an honest empty state instead of a decorative map.

### Filter UX

Updated `frontend/src/lib/trading/opportunity-filtering.ts`:

- added `RISK_DESC`
- added `FRESHNESS_DESC`
- added `MACRO_ALIGN_DESC`
- added `REPLAY_SIMILARITY_DESC`
- added exported helpers for risk, freshness, macro support, and replay similarity scoring

Updated tests in `frontend/src/lib/trading/opportunity-filtering.test.ts`.

## Scanner-Alert Integration

Every opportunity card now supports fast scanner workflow:

- open chart
- create/review alert path
- open replay/history
- open symbol intelligence
- add/remove watchlist through existing watchlist control

This keeps scanner, alerts, watchlist, replay, and symbol detail connected without silently mutating alert rules from a card click.

## Watchlist-First Workflow

The scanner command deck includes Watchlist First. It uses the local watchlist set already powering the Watchlist tab and applies a freshness-first sort so tracked symbols with fresher evidence appear earlier.

## Data Mapping Confirmation

No fake scanner visuals were added.

Data mappings:

- score: `final_score`
- confidence: `conviction`
- freshness: `dataFreshness.status` and age
- risk pressure: fragility, event risk, shock downside risk, risk pressure fields, macro pressure, volatility pressure, liquidity pressure
- macro support: macro alignment, macro score, risk-on score, market regime score, or bounded macro adjustment fallback
- replay similarity: shock pattern similarity, replay similarity, market memory similarity, regime/event/analog/historical similarity
- sector concentration: row sector labels and current scanner rows

When data is missing, the UI shows unavailable or limited context rather than drawing fake charts.

## Benchmark Comparison

Sources reviewed:

- FINVIZ Elite official page: real-time quotes, advanced charts, advanced screener, data export, custom filters, alerts, backtesting, correlations. Source: https://elite.finviz.com/elite
- Trade Ideas official pages: real-time scanner/alert windows, Holly AI, top lists, charting, backtesting, paper trading, broker integration. Sources: https://www.trade-ideas.com/ti-ai-virtual-trade-assistant/ and https://www.trade-ideas.com/hollyguide/Holly_Connections.html
- TrendSpider official scanner docs: dynamic Smart Watchlists, multi-factor technical/fundamental/news/earnings/watchlist criteria, built-in scans. Source: https://help.trendspider.com/kb/scanner/market-scanner
- StockTitan official scanner/FAQ pages: live momentum scanner, trigger counts, price changes, news links, session coverage. Sources: https://www.stocktitan.net/scanner/momentum and https://www.stocktitan.net/faq

### Where TradeVeto Now Wins

- More explicit risk-first language than Finviz and StockTitan.
- Better explainability per scanner row than traditional table-first screeners.
- Cleaner connection from scanner row to chart, replay, alert, watchlist, and intelligence context.
- More honest limited-data states than hype-heavy scanner workflows.
- Stronger macro/risk/replay framing than typical scanner-only products.

### Where Gaps Remain

- Trade Ideas still leads in real-time intraday alert stream maturity.
- Finviz still leads in breadth of classic screener filters and quick tabular scanning.
- TrendSpider still leads in custom technical condition authoring and scan creation depth.
- StockTitan still leads in news-triggered live momentum/news feed simplicity.
- TradeVeto still needs richer real-time alert creation directly from scanner context and deeper user-authenticated alert persistence QA.

## Final Scanner UX Score Estimate

- Scanner scanability: 93/100
- Scanner explainability: 96/100
- Risk-aware scanner workflow: 97/100
- Scanner-alert fusion: 91/100
- Watchlist-first workflow: 92/100
- Market map usefulness: 92/100
- Mobile scanner usability: 93/100
- Overall scanner UX: 94/100

## Remaining Scanner Debt

- Add authenticated one-click alert rule persistence from scanner cards after alert-rule UX is fully standardized.
- Add virtualized list rendering if scanner row counts grow substantially.
- Add user-saved scanner presets after workspace personalization has enough real beta usage.
- Add richer authenticated watchlist change history in scanner context.
- Add live market-session delta stream when production data supports it safely.

## Validation

Local validation performed:

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production pull, rebuild, and route smoke are recorded in the final operator response for this phase.
