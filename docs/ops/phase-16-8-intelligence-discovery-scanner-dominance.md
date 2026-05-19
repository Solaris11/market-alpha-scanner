# Phase 16.8 - Intelligence Discovery + Scanner Dominance System

Date: 2026-05-19
Production SHA: `806712e`
Production URL: `https://tradeveto.com`
Verdict: **TRADEVETO TOP-1 DISCOVERY + SCANNER UX NOT ACCOMPLISHED**

## Executive Summary

Phase 16.8 converted discovery from a buried workflow into a first-class intelligence surface. TradeVeto now has a visible Discover entry point in desktop nav, mobile bottom nav, mobile header, and a global command overlay. The new `/discover` route provides a cinematic scanner workspace with full-universe search, quick filters, sector heatmap, intelligence orbit, momentum/risk clusters, symbol result cards, watchlist filtering, and compare presets.

This materially improves discovery speed, scanner visibility, and mobile market exploration. It does **not** yet reach top-1 scanner/discovery dominance. The production screenshots show that discovery is now strong, but still not at Finviz/Trade Ideas/Bloomberg-class depth for advanced filter breadth, entity search, saved scanner workflows, deep compare modes, and mobile one-handed exploration.

## Implemented Systems

| System | Implementation | Data backing |
|---|---|---|
| Global Discover command | `DiscoveryCommandButton`, `GlobalIntelligenceDiscovery` | `/api/discovery` with premium entitlement gating |
| Dedicated discovery route | `/discover` | `loadIntelligenceDiscoverySystem()` from scanner rows, performance data, shock patterns, narratives, watchlist |
| Discovery model | `intelligence-discovery.ts` | `OpportunityViewModel[]`, `RankingRow`, `readUserWatchlist()` |
| Quick filters | Top gainers, strongest timeframes, weakest, volatility expansion, momentum deterioration, risk escalation, replay-supported, macro-supported, confidence, freshness, watchlist | Real row fields only |
| Visual scanner workspace | Orbit, sector map, gauges, trend cards, factor bars, result cards, compare panel | Existing poster-grade visual primitives |
| Authenticated API | `/api/discovery` | 401/403 limited states for non-premium, 200 for premium |
| Navigation upgrade | Desktop primary nav, mobile bottom nav, mobile mode rail, feedback surfaces, performance budget | Route catalog and tests updated |

## Files Changed

- `frontend/src/app/discover/page.tsx`
- `frontend/src/app/api/discovery/route.ts`
- `frontend/src/components/discovery/DiscoveryCommandButton.tsx`
- `frontend/src/components/discovery/GlobalIntelligenceDiscovery.tsx`
- `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`
- `frontend/src/lib/server/discovery-intelligence.ts`
- `frontend/src/lib/trading/intelligence-discovery.ts`
- `frontend/src/lib/trading/intelligence-discovery.test.ts`
- `frontend/src/lib/navigation.ts`
- `frontend/src/components/terminal/TerminalNav.tsx`
- `frontend/src/components/terminal/TerminalHeader.tsx`
- `frontend/src/components/terminal/TerminalShell.tsx`
- Supporting analytics, robots, entitlement, feedback, and performance budget files.

## Production Deployment

Production was updated with:

```bash
ssh sre@100.68.155.121 "cd /opt/apps/market-alpha-scanner/app && git pull --ff-only origin main && git rev-parse --short HEAD && docker compose up -d --build market-alpha-frontend && docker compose ps market-alpha-frontend"
```

Result:

- Deployed SHA: `806712e`
- Frontend container: `market-alpha-frontend`
- Container health: `healthy`
- `/api/health`: `200`
- `/api/health/deep`: `200`

## Production Smoke

| Route | Status |
|---|---:|
| `/` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/opportunities` | 200 |
| `/symbol/AMD` | 200 |
| `/performance` | 200 |
| `/history?symbol=AMD` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/alerts` | 200 |
| `/dashboard` | 200 |
| `/mobile` | 200 |
| `/account` | 200 |
| `/settings` | 307 redirect |
| `/api/discovery` unauthenticated | 401 |
| `/api/discovery` authenticated premium QA | 200 |

## Production Screenshots

Artifacts:

- Manifest: `docs/ops/artifacts/phase-16-8-prod/manifest.json`
- Desktop: `docs/ops/artifacts/phase-16-8-prod/desktop/`
- Mobile: `docs/ops/artifacts/phase-16-8-prod/mobile/`

Captured desktop:

- `discover-search.jpg`
- `discover-filters.jpg`
- `discover-compare.jpg`
- `discover-symbol-detail.jpg`
- `discover-watchlist-filter.jpg`
- `opportunities-scanner.jpg`
- `performance-explorer.jpg`
- `terminal-nav-discover.jpg`
- `global-discovery-overlay.jpg`

Captured mobile:

- `discover-search.jpg`
- `discover-filters.jpg`
- `discover-compare.jpg`
- `discover-symbol-detail.jpg`
- `discover-watchlist-filter.jpg`
- `opportunities-scanner.jpg`
- `performance-explorer.jpg`
- `terminal-nav-discover.jpg`
- `global-discovery-overlay.jpg`

Mobile/desktop screenshot manifest reported no horizontal overflow for captured discovery surfaces.

## Authenticated QA

Disposable production QA user:

- `phase16-8-qa-20260519@tradeveto.invalid`
- Premium/trialing access inserted directly for QA.
- Legal acceptance inserted for latest legal documents.
- Watchlist seeded with `AMD`, `NVDA`, `TSLA`.
- User deleted after screenshot QA: `DELETE 1`.

Validated:

- Premium `/discover` rendered full-universe scanner data.
- `/api/discovery` returned `200` for authenticated premium QA.
- Watchlist filter showed linked saved symbols.
- Symbol detail overlay opened from a scanner result.
- Global discovery overlay opened on `/terminal`.
- Desktop and mobile screenshots captured after production deploy.

## Discovery UX Assessment

| Dimension | Score | Notes |
|---|---:|---|
| Search visibility | 95 | Discover is now visible in desktop nav, mobile nav, mobile header, and command overlay. |
| Scanner visual richness | 93 | Orbit, heatmap, gauges, mini charts, cards, and compare panels are production-live. |
| Filter discoverability | 90 | Quick filters are strong; advanced filter controls are not yet complete. |
| Full-universe exploration | 91 | Search and cards work, but not all requested dimensions are exposed as controls. |
| Compare workflow | 86 | Symbol compare exists; sector/strategy/replay/environment compare remains shallow. |
| Mobile discovery | 88 | Mobile is visually strong and no horizontal overflow was detected, but deep compare is too far down and bottom nav can cover viewport content. |
| Interaction quality | 91 | Overlays open correctly; automated QA used Escape after role ambiguity around backdrop vs X close. |
| Data trust | 96 | No fake scanner rows or fake charts were introduced. Limited states are explicit. |
| Overall discovery UX | 91 | Major improvement, not yet top-1. |

## Competitor Comparison

| Competitor | TradeVeto now wins | TradeVeto still lags |
|---|---|---|
| Finviz | More explainable, risk-aware, cinematic, watchlist-aware discovery. | Finviz still wins raw filter breadth, density, tabular scan speed, broad market map familiarity. |
| Trade Ideas | Better research framing and evidence/trust language. | Trade Ideas still wins live scanner operator workflows, fast presets, alert/scanner fusion depth. |
| TradingView | Better intelligence story around scanner results. | TradingView still wins symbol exploration depth, chart-linked discovery, community-discovered symbols. |
| TrendSpider | Better high-level risk/replay/macro context. | TrendSpider still wins technical workflow integration and scan-to-chart automation. |
| StockTitan | Better non-hype intelligence language. | StockTitan still wins feed-first market event scanning and habit-loop simplicity. |
| Bloomberg | More approachable and cinematic. | Bloomberg still wins institutional breadth, cross-asset discovery, command search depth. |
| Robinhood/Webull | More intelligent scanner context. | They still win mobile simplicity and ultra-fast single-symbol exploration. |

## Remaining Gaps Blocking Top-1

1. **Advanced filter surface is incomplete.**
   Phase 16.8 requested sector, industry, market cap, exchange, price range, volume, momentum, volatility, risk score, conviction, replay quality, macro alignment, evidence maturity, market memory relevance, watchlist status, alert state, freshness, setup quality, trend quality, confidence, fragility, and shock risk. The model supports many of these fields, but the production UI exposes only query, sector, sort, timeframe, and quick filters.

2. **Discovery search is still symbol-first.**
   It returns symbols and clusters, but not true first-class search result objects for risk themes, macro conditions, replay analogs, strategy environments, watchlist changes, and market memory signals.

3. **Compare mode is too shallow.**
   It supports side-by-side symbol factor comparison and presets, but not sector vs sector, strategy vs strategy, replay analog vs current, historical environment comparison, or risk-state comparison.

4. **Mobile discovery is visually strong but not yet effortless.**
   The mobile Discover route is long, the compare anchor lands very deep, and the fixed bottom nav can cover lower viewport content. It is usable, but not yet Robinhood/Webull-class one-handed exploration.

5. **No saved scanner workspaces yet.**
   There is no persistent saved filter set, named discovery workspace, or personal scanner preset system.

6. **No virtualized large-universe result grid yet.**
   Current production universe is 111 rows and performs acceptably. A much larger market universe would need virtualization and lazy chart rendering.

7. **Related discovery is not fully contextual.**
   The new global layer is available everywhere, but symbol pages do not yet open `/discover` prefiltered to related peers, sector movers, replay analogs, macro-sensitive names, or deteriorating competitors.

8. **Physical mobile QA was not performed.**
   Production screenshots used Playwright mobile emulation. Browser emulation is useful but does not replace real iPhone Safari, Chrome Android, and in-app browser testing.

## Validation

Local validation:

- `cd frontend && npm run lint` - passed
- `cd frontend && npm test -- --runInBand` - passed, 409/409
- `cd frontend && npm run build` - passed
- `cd frontend && npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors/warnings
- `git diff --check` - passed before commit

Production validation:

- Docker rebuild completed.
- Frontend container healthy.
- Health and deep health endpoints passed.
- Production route smoke passed with expected `/settings` redirect and `/api/discovery` unauthenticated 401.
- Authenticated premium `/api/discovery` returned 200.
- Desktop and mobile production screenshots captured.

## Final Decision

TradeVeto has a much stronger discovery and scanner foundation after Phase 16.8. It is no longer hidden, fragmented, or dependent on the Opportunities page alone. The new Discover surface is a genuine production route with real scanner data, real visual systems, and global navigation access.

It is still not the best market discovery and scanner UX in the industry. The main blockers are advanced filter breadth, entity-level search, deeper compare workflows, contextual related discovery, saved scanner workspaces, and real-device mobile confirmation.

TRADEVETO TOP-1 DISCOVERY + SCANNER UX NOT ACCOMPLISHED
