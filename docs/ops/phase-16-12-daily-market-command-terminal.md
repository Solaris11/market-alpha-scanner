# Phase 16.12 Daily Market Command Terminal

Date: 2026-05-19

## Objective

Move Terminal away from a settings/workspace-first surface and make the first screen answer what matters today:

- where opportunity is highest
- where danger is highest
- where expansion potential is highest
- where money flow is moving
- what changed today
- what market developments can affect watchlist and opportunity symbols

## Implementation Summary

- Added a data-backed Daily Market Command model in `frontend/src/lib/trading/daily-market-command.ts`.
- Added the cinematic Terminal-first command surface in `frontend/src/components/terminal/DailyMarketCommandCenter.tsx`.
- Moved `WorkspacePersonalizationPanel` lower on `/terminal`, below the market command and chart intelligence surfaces.
- Added tests for ranking construction, market developments, watchlist impact, calendar mapping, and no-news empty states.
- Deployed and validated production commit `1161231`.

## Terminal Redesign

The first production Terminal viewport now opens with `Today's Command Center` instead of workspace controls.

The hero includes:

- current market state
- attention score gauge
- first research target
- first risk review
- opportunity, danger, and money-flow chips on mobile
- generated timestamp and freshness context
- narrative summary of why the top items matter now

## Ranking Systems

### Top 5 Best Setups

Data source:

- `rankedZones["best-setups"]`
- current scanner/opportunity rows
- opportunity score, conviction, evidence maturity, setup context, macro alignment, replay context, price, and daily move fields where available

Displayed fields:

- rank
- symbol and company
- category-specific score
- price
- 1D move
- macro label
- reason for ranking
- factor strip for score, conviction, replay, and risk

### Highest Expansion Potential

Data source:

- `rankedZones["shock-watch"]`
- `rankedZones["volatility-pressure"]`
- scanner shock, volatility, event, and replay fields

Ranking intent:

- breakout pressure
- volatility expansion/compression
- shock similarity
- momentum context
- event pressure
- macro/replay support where available

### Highest Downside / Crash Risk

Data source:

- `rankedZones["dangerous-now"]`
- `rankedZones["risk-review"]`
- risk score, fragility, volatility pressure, macro pressure, event pressure, weak structure, and avoid/review workflow fields

Ranking intent:

- downside pressure
- crash/risk review urgency
- weak structure
- poor timing
- fragility
- risk/reward weakness

## Money Flow Systems

The `Where Money Is Flowing` section aggregates sector-level scanner rows into:

- strongest sectors
- weakest sectors
- average 1D move
- average opportunity score
- average risk score
- sector leaders
- breadth summary
- leadership and pressure themes

The current production capture shows Energy leading flow, while broad cross-asset pressure is contained in the hero narrative.

## What Changed Today

The `What Changed Today` rail is driven by validated TradeVeto workflow/ranked-zone deltas and current scanner context. It surfaces:

- biggest risk changes
- watchlist-impact shifts
- opportunity/risk priority changes
- money-flow themes
- macro/sector changes when present

If scan-to-scan change evidence is missing, the component shows a limited-evidence state instead of inventing changes.

## Daily Market Developments Center

A high-priority `Daily Market Developments` section now appears in the upper Terminal experience.

It supports:

- source-linked market-moving headlines
- macro/rates/geopolitical/company categories
- watchlist-impact labels
- affected-symbol chips
- affected-sector context
- urgency and impact badges
- quick filters: All, My Watchlist, Macro, Earnings, Rates, Geopolitical, Crypto, Energy, High Impact
- stable overlay detail with original source link, affected symbols, affected sectors, relevance, reason codes, timestamp, and research-only language

Data rule:

- No fabricated news is shown.
- News cards are created only from `MarketCommandModel.macroNews` items with a verified `sourceUrl`.
- If source-linked news is unavailable, the section displays `News source not configured yet` and documents the required feed integration.

The production QA snapshot contained 7 source-linked market developments.

## Daily Events Calendar

The Terminal now includes a compact 7-day event calendar sourced from validated symbol-level event fields:

- earnings dates
- dividend/ex-dividend dates where present
- macro/event dates if represented in the stored packet

If no validated calendar fields are present, the component shows a limited-data state.

## Mobile UX

Mobile Terminal now prioritizes the daily briefing before workspace controls.

Implemented:

- setup/risk/flow chips in the first command viewport
- mobile-safe ranked cards with wrapped score badges
- two-column stat grids for ranked rows
- horizontally scrollable filter chips
- bottom navigation preserved
- no observed horizontal clipping in the latest production screenshot

## Production Screenshots

Desktop:

- [Terminal command center](artifacts/phase-16-12-prod/desktop/terminal-home-command-center.png)
- [Daily command section](artifacts/phase-16-12-prod/desktop/daily-command-center-section.png)
- [Money flow and changes](artifacts/phase-16-12-prod/desktop/money-flow-and-changes.png)
- [Daily market developments](artifacts/phase-16-12-prod/desktop/daily-market-developments.png)
- [Daily development overlay](artifacts/phase-16-12-prod/desktop/daily-development-overlay.png)

Mobile:

- [Mobile command center](artifacts/phase-16-12-prod/mobile/terminal-command-center-mobile.png)
- [Mobile top setups](artifacts/phase-16-12-prod/mobile/top-setups-mobile.png)
- [Mobile daily market developments](artifacts/phase-16-12-prod/mobile/daily-market-developments-mobile.png)

## Production Validation

Production deployment:

- Commit deployed: `1161231`
- Frontend container: healthy
- `/api/health`: 200
- `/api/health/deep`: 200
- `/terminal`: 200
- `/opportunities`: 200
- `/symbol/AMD`: 200
- `/dashboard`: 200

Production QA:

- Created disposable premium QA user.
- Seeded watchlist with `AMD`, `NVDA`, `MU`, `TSLA`, `COIN`, `MSFT`, `AMAT`, `TSM`.
- Captured authenticated production desktop and mobile screenshots.
- Verified Terminal opens with the Daily Market Command Center above workspace personalization.
- Verified top setup, expansion, crash-risk, money-flow, changes, development, and calendar sections are visible on production.
- Verified daily development overlay opens in-place with a source link and closes without route navigation.
- Verified mobile ranked-card layout after the final containment fix.

## Local Validation

- `npm --prefix frontend run lint`: pass
- `npm --prefix frontend test -- --runInBand`: pass
- `npm --prefix frontend run build`: pass
- `npm --prefix frontend audit --omit=dev`: pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: pass
- `npx pyright . --pythonpath .venv/bin/python --warnings`: pass, 0 errors
- `git diff --check`: pass

## Remaining Gaps

- A dedicated live news provider is still recommended. The current implementation correctly uses only source-linked stored market news and otherwise shows a no-news configured state.
- The daily calendar depends on stored symbol/event fields. A complete economic-calendar integration would improve Fed, CPI, PPI, jobs, GDP, and macro-event coverage.
- Physical-device QA was not performed in this pass; production mobile screenshots were captured with Playwright iPhone emulation.
- Symbol-specific news depth remains dependent on the Phase 16.9 research/news feed inputs.

## Final Status

TRADEVETO DAILY MARKET COMMAND TERMINAL ACCOMPLISHED
