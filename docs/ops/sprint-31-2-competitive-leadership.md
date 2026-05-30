# Sprint 31.2 - Competitive Gap Closure + Category Leadership

## Verdict

Pending production certification.

## Objective

Systematically compare TradeVeto against the current public feature positioning of:

- TradingView
- Finviz
- Seeking Alpha
- TrendSpider
- Koyfin
- StockAnalysis
- Benzinga
- MarketBeat

The goal is category leadership where TradeVeto can honestly lead:

- AI market intelligence
- Market memory
- Opportunity ranking
- Cross-market context
- Personalized research workflows

This sprint does not claim full charting-platform, social-network, broker, or mobile-app parity.

## Source-Backed Benchmark References

| Platform | Source |
| --- | --- |
| TradingView | https://www.tradingview.com/features/ |
| Finviz Elite | https://elite.finviz.com/elite |
| Seeking Alpha | https://help.seekingalpha.com/premium/seeking-alpha-premium-feature-list |
| TrendSpider | https://trendspider.com/product/ |
| Koyfin | https://www.koyfin.com/help/topic/functionality/ |
| StockAnalysis | https://stockanalysis.com/ |
| Benzinga Pro | https://www.benzinga.com/pro/feature/alerts |
| MarketBeat | https://www.marketbeat.com/all-access/ |

## Implementation Summary

- Added a deterministic competitive leadership model at `frontend/src/lib/trading/competitive-leadership.ts`.
- Added full matrix coverage for 8 competitors x 11 capabilities.
- Added documented ranking for every platform/capability pair:
  - `ahead`
  - `equal`
  - `behind`
- Added gap severity, effort estimate, closure plan, and verification text for every row.
- Added category leadership target certification:
  - 3+ intelligence leadership categories
  - 2+ workflow leadership categories
  - 1+ AI leadership category
- Added production API:
  - `/api/intelligence/competitive-leadership`
- Added deterministic unit tests for:
  - matrix coverage
  - source coverage
  - behind-gap documentation
  - critical gap count
  - category leadership target counts
  - unsupported parity-claim guardrails
- Added production proof probe:
  - `npm --prefix frontend run probe:sprint31:competitive-leadership`

## Competitive Capability Matrix

The production model covers:

- screeners
- alerts
- charts
- replay
- portfolio analysis
- macro intelligence
- AI capabilities
- market memory
- research workflows
- social features
- mobile experience

## Leadership Claims

TradeVeto is certified only for bounded category leadership in:

| Category | Type | Claim Boundary |
| --- | --- | --- |
| AI market intelligence | AI | Grounded natural-language market Q&A using deterministic TradeVeto packets. |
| Market memory | Intelligence | Replay, symbol history, analogs, and workflow evolution connected to current research. |
| Opportunity ranking | Intelligence | Score, conviction, fragility, macro, event, replay, and watchlist fit in one ranked model. |
| Cross-market context | Intelligence | Macro regime, rates, volatility, event state, sector pressure, and scanner impact. |
| Personalized research workflows | Workflow | Watchlist, risk profile, prior questions, saved scans, alerts, and copilot context. |
| Research workflow completion | Workflow | Scanner to symbol to chart to alert to history/performance paths in one workflow. |

## Explicit Non-Claims

- No full TradingView charting parity.
- No TrendSpider automation/backtesting parity.
- No TradingView-scale social network parity.
- No broker execution parity.
- No guaranteed signal quality or investment outcome.
- No financial advice.
- No claim that TradeVeto is best in every category.

## Local Validation

Pending.

## Production Deployment

Pending.

## Production Smoke

Pending.

## Competitive Leadership Proof

Pending.

## Remaining Blockers

- Production certification is pending until deploy and proof probe complete.
