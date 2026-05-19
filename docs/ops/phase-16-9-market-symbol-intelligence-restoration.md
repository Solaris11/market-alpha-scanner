# Phase 16.9 — Market + Symbol Intelligence Restoration

Date: 2026-05-19

## Outcome

Phase 16.9 restored visible market monitoring and symbol-level research depth without adding fake intelligence. The production app now exposes a cross-asset market command surface on Terminal and Dashboard, and Symbol Detail now includes a dedicated research cockpit for company overview, scanner fundamentals, earnings, dividends, source-linked news, bullish/bearish factors, and macro connections.

Final verdict: **TRADEVETO COMPLETE MARKET + SYMBOL INTELLIGENCE SYSTEM NOT ACCOMPLISHED**

The core restoration is real and deployed, but the complete target is not fully met because the current data layer still lacks validated company descriptions, CEO/HQ profiles, full financial statements/cash flow, earnings surprise history, dividend payout history, and a dedicated broad macro/geopolitical news provider.

## Implemented Components

- `frontend/src/lib/trading/market-research.ts`
  - Builds a shared market command model from validated cross-asset chart packets and scanner rows.
  - Builds source-linked macro/company news items from `verified_event_recent_events`.
  - Builds symbol deep-research models from scanner fundamentals, events, earnings, dividends, and macro fields.
  - Deduplicates verified events across symbols and rewrites merged context as cross-asset context.

- `frontend/src/components/market/GlobalMarketCommandCenter.tsx`
  - Adds visible Nasdaq/Dow/S&P/BTC/gold/oil/dollar/bonds market monitoring.
  - Shows price, 1D change, 1M change, mini charts, freshness, market pressure, and source/provenance.
  - Cards open stable overlays with interactive charts and verified source-linked context.

- `frontend/src/components/research/SymbolDeepResearchCockpit.tsx`
  - Adds company profile, fundamentals, earnings, dividend, macro connection, bullish/bearish factor, news, and research-gap panels.
  - Uses limited-data states where real fields are unavailable.
  - News cards open stable source-detail overlays with original source links.

- `frontend/src/lib/interactive-chart-data.ts`
  - Added `3mo` timeframe support across interactive charts.

## Page Wiring

- Terminal: `GlobalMarketCommandCenter` appears near the top of the premium cockpit.
- Dashboard: `GlobalMarketCommandCenter` appears as a workspace market command block.
- Symbol Detail: `SymbolDeepResearchCockpit` appears directly after the decision hero / global research mode warning and before the existing cinematic symbol intelligence layers.

## Data Mapping

- Cross-asset chart cards:
  - Powered by `getMarketChartHubData()`.
  - Covered symbols: `SPY`, `QQQ`, `DIA`, `BTC`, `GLD`, `USO`, `UUP`, `TLT`.
  - Timeframes include `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`.

- Macro/news feed:
  - Powered only by scanner `verified_event_recent_events`.
  - Requires source, source URL, headline, timestamp, and HTTP(S) link.
  - Missing news shows a limited-data state.

- Symbol financials:
  - Uses available scanner row fields such as `market_cap`, `revenue_growth`, `earnings_growth`, `profit_margin`, `operating_margin`, `gross_margin`, `debt_to_equity`, `trailing_pe`, and `forward_pe`.

- Earnings:
  - Uses `earnings_date` and event-risk context when available.
  - Surprise/reaction history is explicitly marked limited unless stored in the packet.

- Dividends:
  - Uses `dividend_yield` when available.
  - Ex-dividend date, payout history, and dividend growth are marked limited unless stored.

## Production Screenshots

Captured after deploying commit `3789c3e` to production:

- `docs/ops/artifacts/phase-16-9-prod/desktop/terminal-market-command.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/dashboard-page.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/cross-asset-detail-overlay.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/amd-company-research.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/amd-news-detail-overlay.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/nvda-company-research.jpg`
- `docs/ops/artifacts/phase-16-9-prod/desktop/btc-research-limited-state.jpg`
- `docs/ops/artifacts/phase-16-9-prod/mobile/terminal-market-command.jpg`
- `docs/ops/artifacts/phase-16-9-prod/mobile/cross-asset-detail-overlay.jpg`
- `docs/ops/artifacts/phase-16-9-prod/mobile/amd-company-research.jpg`
- `docs/ops/artifacts/phase-16-9-prod/mobile/amd-news-detail-overlay.jpg`
- `docs/ops/artifacts/phase-16-9-prod/mobile/btc-research-limited-state.jpg`

Full desktop/mobile route screenshot sets were also captured for Terminal, Dashboard, Opportunities, AMD/NVDA/BTC Symbol Detail, Performance, History, Alerts, Paper, Strategy Labs, Mobile Setup, Account, and Settings.

## Production Validation

Local validation:

- `npm run lint` passed.
- `npm test -- --runInBand` passed: 411 tests.
- `npm run build` passed.
- `npm audit --omit=dev` passed: 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` passed: 0 errors, 0 warnings.
- `git diff --check` passed.

Production validation:

- Production frontend rebuilt and redeployed from `main`.
- Container health: healthy.
- `/api/health`: 200.
- `/api/health/deep`: 200; database ok, backups ok, scanner fresh.
- Route smoke:
  - `/`, `/terminal`, `/dashboard`, `/opportunities`, `/symbol/AMD`, `/symbol/NVDA`, `/symbol/BTC`, `/performance`, `/history?symbol=AMD`, `/alerts`, `/paper`, `/strategy-labs`, `/mobile`, `/account`: 200.
  - `/settings`: 307 redirect into account/settings flow, expected for authenticated account routing.

Authenticated QA:

- Disposable premium QA user created for screenshots and then deleted.
- Premium routes rendered.
- Market command overlays opened and closed on desktop/mobile.
- AMD company research and news overlays opened and closed on desktop/mobile.

Mobile QA:

- Captured with iPhone Safari-like user agent and 390x844 viewport.
- Bottom-sheet overlays rendered with visible sticky close.
- Full physical-device QA was not performed in this pass.

## Competitor Review

- Bloomberg: TradeVeto now restores more visible cross-asset awareness and source-linked context, but still lacks Bloomberg-grade live macro/news data breadth and full company reference fields.
- TradingView: TradeVeto has stronger research framing around cross-asset chart context, but does not yet match TradingView's deep charting ecosystem.
- StockTitan / Yahoo Finance / Seeking Alpha: TradeVeto now exposes source-linked headlines and why-it-matters context, but does not yet match their raw company-news breadth.
- Finviz / Webull / Robinhood: TradeVeto now presents richer research context than a simple quote/profile page, but fundamentals and corporate profile coverage remain thinner than dedicated data terminals.

## Remaining Gaps

- Add a validated company reference data provider for company descriptions, CEO, headquarters, exchange metadata, and corporate profile fields.
- Add validated financial statement data: revenue, income, balance sheet, cash flow, margins by period, debt trend, EPS trend.
- Add earnings history: surprise, guidance, prior reaction, post-earnings volatility, replay context around prior reports.
- Add dividend history: ex-dividend dates, payout schedule, dividend growth, payout ratio.
- Add dedicated macro/geopolitical news feeds with source policy, dedupe, sector/asset impact mapping, and freshness.
- Add true market overview route or dedicated Macro Command route so market intelligence is not only embedded in Terminal/Dashboard.
- Add physical-device QA for iPhone Safari and Android Chrome.

## Final Status

TRADEVETO COMPLETE MARKET + SYMBOL INTELLIGENCE SYSTEM NOT ACCOMPLISHED
