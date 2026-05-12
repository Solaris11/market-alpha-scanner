# Phase 13.4 Real Visual Intelligence System

Date: 2026-05-12

## Executive Summary

This pass removes the most visible trust risk in the Phase 13 visual upgrade: UI elements that looked like live market intelligence but were powered by static, seeded, or decorative patterns.

TradeVeto now treats visual widgets as evidence surfaces. If validated data exists, the UI maps the visual to real scores or real histories. If validated data does not exist, the UI shows an honest empty state instead of drawing a synthetic chart.

## Dummy Visuals Removed Or Replaced

- `TerminalRightRail.tsx`: watchlist strips no longer use static pseudo-candle arrays. They now show latest scored factors: score, confidence, stability, and evidence.
- `UnifiedIntelligenceConsole.tsx`: opportunity/risk mini visuals no longer use invented trend arrays. They now show deterministic attention, opportunity, timing, decision, risk, and urgency factors from the unified intelligence packet.
- `OpportunitiesWorkspace.tsx`: opportunity cards no longer show a fake "quality curve." They now show score, conviction, stability, evidence, and event risk.
- `SymbolDecisionHero.tsx`: removed the synthetic "signal shape" curve. It now shows data-backed signal factors: score, macro adjustment, conviction, stability, and evidence maturity.
- `AICopilotPanel.tsx`: removed formula-style mini candles. It now shows deterministic confidence, readiness, and setup factors only.
- `DailyActionCard.tsx`: removed fake offset bars. Decision mix now renders real share-of-current-decision-distribution values.
- `StrategyLabsWorkspace.tsx`: removed fixed simulation bars. The panel now shows strategy quality, win rate, normalized return, drawdown safety, and volatility control from simulated strategy stats.
- `SymbolChart.tsx` / `symbol-chart-utils.ts`: removed seeded fallback OHLC generation. Symbol charts now render only validated price candles.
- `GhostPortfolioCard.tsx`: removed fake default paper PnL and deterministic lift. The card now stays empty until real closed paper trades have enough context.
- `MiniVisuals.tsx`: reusable mini visual components no longer fabricate default values. Missing data produces explicit limited-history messaging.

## Real Data Mappings

- Watchlist visual factors: `final_score`, `confidence_score`, inverse `fragility_score`, evidence maturity score.
- Opportunity visual factors: `final_score`, conviction, inverse fragility, evidence score, event risk.
- Unified console opportunity factors: attention priority, opportunity score, timing quality, decision quality.
- Unified console risk factors: risk score, urgency score, attention priority, timing quality.
- Symbol hero factors: final score, macro-adjusted score, conviction, stability, evidence score.
- Decision assistant factors: confidence, readiness, setup strength.
- Strategy Labs factors: strategy quality, win rate, return normalization, drawdown safety, volatility control.
- Symbol price chart: validated OHLC candles only.

## Explanation Architecture

The replacement visual system uses `ScoreFactorStrip` for compact, inspectable score breakdowns. Each factor can carry a detail tooltip and every strip has an explicit label. Empty states now explain whether the blocker is insufficient history, insufficient scored evidence, or missing validated OHLC data.

## Visual Hierarchy

The UI keeps the richer Phase 13 visual style, but removes the parts that could imply false precision. Bars are used for bounded real scores. Charts are used only when real points are present. Product marketing previews are labeled as illustrative and separated from live market intelligence.

## Performance Impact

No new charting libraries or heavy client dependencies were added. The changes replace static mini charts with lightweight DOM/CSS score bars and remove seeded chart generation. Expected route performance impact is neutral to slightly positive.

## Validation

Local validation completed:

- `npm run lint`: pass
- `npm test -- --runInBand`: pass, 371 tests
- `npm run build`: pass
- `npm audit --omit=dev`: pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: pass
- `npx pyright . --pythonpath .venv/bin/python --warnings`: pass, 0 errors
- `git diff --check`: pass

Production validation completed from the production host after commit/push:

- Commit deployed: `3190009 Ground visual intelligence in real data`
- Production host: `onsre-node-01`
- Docker service rebuilt: `market-alpha-frontend`
- Frontend container: healthy
- `/api/health`: pass, HTTP 200, `ok: true`
- `/api/health/deep`: pass, HTTP 200, DB/scanner/local backup/R2 backup ok
- Route smoke from production host:
  - `/`: HTTP 200
  - `/terminal`: HTTP 200
  - `/opportunities`: HTTP 200
  - `/symbol/AMD`: HTTP 200
  - `/performance`: HTTP 200
  - `/history?symbol=AMD`: HTTP 200
  - `/strategy-labs`: HTTP 200
  - `/paper`: HTTP 200
  - `/dashboard`: HTTP 200
  - `/mobile`: HTTP 200
- Protected API smoke:
  - `/api/v1/opportunities`: HTTP 401, fail-closed
  - `/api/v1/macro`: HTTP 401, fail-closed
  - `/api/v1/shocks`: HTTP 401, fail-closed
  - `/api/v1/replay?symbol=AMD`: HTTP 401, fail-closed
  - `/api/v1/portfolio/scenario`: HTTP 405 for GET-only smoke, fail-closed for the wrong method

Visual QA screenshots captured against production with the anonymous legal gate acknowledged:

- `/tmp/tradeveto-visual-qa/opportunities-desktop-accepted.png`
- `/tmp/tradeveto-visual-qa/opportunities-mobile-accepted.png`
- `/tmp/tradeveto-visual-qa/performance-desktop-accepted.png`
- `/tmp/tradeveto-visual-qa/symbol-amd-desktop-accepted.png`

The production `/performance` route specifically no longer reproduces the browser "This page couldn't load" failure during smoke and screenshot QA.

## Remaining Visual Debt

- Full historical confidence trend lines require more persisted per-user/watchlist history.
- Broader replay visualization can become richer after more validated replay snapshots accumulate.
- Marketing/product-preview visuals should remain clearly labeled as illustrative unless wired to live public data.
- A deeper mobile visual QA pass should continue after the production rebuild.

Final status: REAL VISUAL INTELLIGENCE SYSTEM COMPLETE
