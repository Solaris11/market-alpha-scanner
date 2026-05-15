# Phase 15.4 - Composer-Level Strategy Lab OS

Date: 2026-05-15

## Executive Summary

Phase 15.4 upgrades Strategy Labs from a simulation dashboard into a guided strategy research workspace. The page now explains what a strategy sleeve is, how the simulation gates work, what evidence supports the result, where assumptions are limited, and how a user can move from simulation into paper practice without implying live trading or guaranteed outcomes.

Final status: PHASE 15.4 COMPOSER LEVEL STRATEGY LAB OS COMPLETE

## What Changed

- Added a beginner-first three-step Strategy Labs guide: choose a sleeve, check evidence, practice safely.
- Added starter templates for Conservative, Balanced, and Aggressive research sleeves with clear "works poorly" and "invalidates" explanations.
- Added a visual strategy builder that maps the selected sleeve to real simulation fields: minimum score, fragility cap, allocation range, and evidence horizon.
- Added an evidence and assumptions trust layer using closed simulated trade count, horizon, average hold, volatility, and the existing simulation limitations.
- Added a replay review panel that uses real closed simulated trades, real returns, real dates, and real entry/exit reasons.
- Added a Paper Trading bridge that links the selected strategy mode into Paper Trading while keeping the simulation boundary explicit.
- Made Strategy Labs symbol references clickable to the corresponding symbol detail route.

## Real Data Mapping

| UX Element | Data Source | Trust Behavior |
| --- | --- | --- |
| Strategy quality gauge | `result.stats.strategyQualityScore` | Shows numeric quality from simulation stats |
| Starter templates | `result.config` and mode copy | Uses real thresholds and allocation settings |
| Score gate | `result.config.minModeScore` | Explains the required simulated entry threshold |
| Fragility cap | `result.config.maxFragilityScore` | Shows risk gate before upside is considered |
| Allocation range | `baseAllocationPct` to `maxAllocationPct` | Shows bounded simulated exposure |
| Evidence horizon | `system.primaryHorizon` | Shows completed evidence horizon |
| Evidence status | `stats.closedTradeCount` | Labels mature, developing, limited, or absent evidence |
| Replay review | `closedTrades` | Uses real simulated trade dates, returns, reasons, and symbols |
| Paper bridge | selected `mode` | Links to paper mode without creating brokerage or billing side effects |

No fake equity curves, fake replay events, fake strategy signals, or fake live pricing were added.

## Strategy Builder UX

The builder is intentionally no-code and risk-first. It shows the selected sleeve as a sequence of understandable gates:

1. Score gate: current symbols must clear the selected mode threshold.
2. Fragility cap: high fragility blocks or reduces exposure before upside is considered.
3. Allocation range: allocation remains bounded by the selected research sleeve.
4. Evidence horizon: the simulator reads completed outcome windows only.

This keeps Strategy Labs closer to a guided education product than quant admin tooling.

## Simulation UX

Simulation results now foreground:

- closed evidence count
- win rate
- drawdown
- volatility
- average hold
- strategy quality
- benchmark context
- entry and exit reasoning

When evidence is missing, Strategy Labs shows explicit empty states instead of pretending a chart is meaningful.

## Replay Integration

The replay review panel shows recent completed simulated trades using:

- symbol
- outcome horizon
- realized return
- entry date
- exit date
- entry context
- exit context

Each symbol links to its symbol detail page for deeper research. This makes replay a chronological explanation layer rather than a hidden table.

## Paper Trading Fusion

The new Paper Trading bridge gives users a safe next step:

- choose one research idea
- record entry, stop, target, and notes
- review later with replay context

The page clearly states that Paper Trading remains separate from live billing and brokerage execution.

## Beginner Guidance

Strategy Labs now makes these concepts explicit:

- a strategy sleeve is a research template, not a trading instruction
- each sleeve has different risk tolerance
- evidence quality matters before confidence
- weak evidence should be paper tested first
- simulations are historical observations, not forecasts

## Benchmark Comparison

Official public references used:

- Composer positions itself around visual, no-code strategy creation and automation: https://www.composer.trade/
- TrendSpider documents strategy testing/backtesting as part of its technical workflow: https://help.trendspider.com/
- TradingView documents strategies, backtesting, forward testing, and its Strategy Tester workflow: https://www.tradingview.com/support/categories/strategy-tester/

| Product | Strength | TradeVeto Improvement This Sprint | Remaining Gap |
| --- | --- | --- | --- |
| Composer | Beginner-friendly visual strategy construction | Strategy sleeves now explain assumptions, poor-fit conditions, and invalidation in plain language | TradeVeto still does not offer a full drag/drop strategy editor |
| TrendSpider | Technical strategy testing and chart workflow | Strategy simulation is now tied to risk, fragility, evidence, and replay explanations | Deeper chart-linked strategy overlays remain Phase 15.1/15.5 debt |
| TradingView | Powerful strategy and chart ecosystem | TradeVeto is more explicit about risk-first interpretation and evidence limits | TradingView still leads on script ecosystem and chart tooling breadth |

## Remaining Strategy Debt

- Add richer chart-linked strategy overlays once more validated price/replay history is available.
- Add saved custom strategy preferences only after the guided sleeves prove useful in beta.
- Add side-by-side strategy comparison once users have enough real paper-trade history.
- Add strategy-linked paper trade review summaries after more user data exists.

## Validation Results

Local validation completed before production deploy:

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --runInBand` | PASS - 393 tests |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | PASS |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | PASS - 0 errors |
| `git diff --check` | PASS |
| `npm run test:mobile-ux` | PASS - local emulation, 11 routes, 2 devices |

Local mobile emulation ran without production DB credentials, so premium Strategy Labs content was locked in local screenshots. Production smoke should verify the authenticated/premium state after deploy.

## Final Strategy UX Score Estimate

| Category | Estimate |
| --- | ---: |
| Beginner clarity | 94 |
| Simulation explainability | 94 |
| Risk visualization | 92 |
| Replay integration | 91 |
| Paper-trading bridge | 90 |
| Mobile readability | 91 |
| Trust / non-advisory framing | 97 |
| Overall Strategy Labs UX | 93 |

The sprint moves Strategy Labs from polished beta toward premium guided simulation. It is not yet a full Composer-style no-code builder, but it is safer, clearer, and more explainable for controlled beta users.
