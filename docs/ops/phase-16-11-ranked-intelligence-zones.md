# Phase 16.11 Ranked Intelligence Zones

Date: 2026-05-19

## Objective

Transform Terminal clickable intelligence zones from shallow single-example cards into ranked mini-scanners. Each zone now exposes a category-specific ranked symbol queue, preview rows on the card, and a stable detail overlay with top-10 ranked scanner context.

## Implementation Summary

- Added `rankedZones` to the unified console model.
- Added category-specific top-10 ranked symbol queues for:
  - Market State
  - Best Setups
  - Dangerous Now
  - Shock Watch
  - Watchlist Intelligence
  - What Changed
  - Risk Review
  - Volatility Pressure
  - Macro Pressure
  - Replay Context
- Extended the Terminal intelligence-zone cards to show ranked symbol previews.
- Extended the existing stable overlay system to render a ranked scanner view with:
  - rank number
  - symbol logo
  - score
  - price and daily move context
  - setup context
  - entry/risk-reward context when available
  - reason for ranking
  - factor bars
  - link to symbol detail
- Preserved the existing stable overlay behavior:
  - no route jump for zone details
  - ESC close
  - mobile bottom-sheet behavior
  - scroll preservation through `StableDetailOverlay`
- Passed authenticated watchlist symbols into the Terminal unified console so the Watchlist Intelligence zone can rank user-tracked symbols first.

## Ranking Logic Per Zone

| Zone | Ranking logic |
| --- | --- |
| Best Setups | Opportunity score, final score, conviction, evidence maturity, macro support, risk/reward, lower fragility |
| Dangerous Now | Risk score, fragility, volatility pressure, event risk, downside pressure, weak macro alignment, avoid-state pressure |
| Shock Watch | Current shock similarity, upside shock, two-sided volatility, event shock pressure, volatility pressure, recent movement, extension |
| Risk Review | Risk score, risk/reward weakness, fragility, stop proximity, entry extension, timing weakness, evidence weakness |
| Macro Pressure | Macro drag, sector drag, macro pressure, liquidity pressure, volatility pressure, event macro pressure |
| What Changed | Workflow changes, score deltas, risk/fragility deltas, confidence/readiness deltas |
| Watchlist Intelligence | User watchlist symbols first, workflow changes, score drift, conviction, risk drift, alert/event pressure |
| Replay Context | Shock similarity, analog quality, regime similarity, event similarity, reliability, historical sample depth |
| Volatility Pressure | Volatility pressure, shock risk, recent movement, fragility, regime/liquidity pressure |
| Market State | Unified attention score, urgency, risk intensity, opportunity intensity, current scanner score |

## Data Sources Used

- Current scanner rows through `OpportunityViewModel`
- TradeVeto operating system priority and danger queues
- Shock pattern model fields
- Macro/sector alignment fields
- Risk/reward and entry context fields
- Evidence maturity and reliability fields
- Workflow evolution and watchlist evolution
- Authenticated user watchlist symbols
- Stored price and daily move fields where available

If a zone has fewer than five valid symbols, the UI now shows only validated rows and displays `Limited ranked evidence available`.

## Production Screenshots

Desktop:
- [Terminal ranked zones](artifacts/phase-16-11-prod/desktop/terminal-ranked-zones-viewport.png)
- [Dangerous Now overlay](artifacts/phase-16-11-prod/desktop/dangerous-now-overlay-viewport.png)
- [Best Setups overlay](artifacts/phase-16-11-prod/desktop/best-setups-overlay.png)

Mobile:
- [Terminal ranked zones mobile](artifacts/phase-16-11-prod/mobile/terminal-ranked-zones-mobile-viewport.png)
- [Dangerous Now bottom sheet mobile](artifacts/phase-16-11-prod/mobile/dangerous-now-bottom-sheet-mobile-viewport.png)

Full-page captures are also stored under `docs/ops/artifacts/phase-16-11-prod/`.

## Production Validation

Production deployment:
- Commit deployed: `d2b2749`
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
- Captured authenticated desktop and mobile screenshots.
- Verified ranked previews on production for Best Setups, Dangerous Now, Shock Watch, Watchlist Intelligence, Risk Review, Volatility Pressure, What Changed, Replay Context, and Macro Pressure.
- Verified Dangerous Now overlay opens in-place with top-10 ranking and factor bars.
- Verified mobile Dangerous Now opens as a stable bottom sheet.
- Cleaned up disposable QA user after screenshot capture.

## Local Validation

- `npm run lint`: pass
- `npm test -- --runInBand`: pass, 412 tests
- `npm run build`: pass
- `npm audit --omit=dev`: pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: pass
- `npx pyright . --pythonpath .venv/bin/python --warnings`: pass, 0 errors
- `git diff --check`: pass

## Remaining Gaps

- `What Changed` can still show limited evidence when production workflow history has only one valid symbol-level change. This is intentional and follows the no-fake-data rule.
- Some zones depend on available scanner fields. If a future scan omits shock, analog, or macro fields, the zone will degrade to validated rows only with limited-evidence messaging.
- Symbol link clicks intentionally navigate to symbol detail; zone detail overlays preserve page context until that explicit navigation occurs.

## Final Status

TRADEVETO RANKED INTELLIGENCE ZONES COMPLETE
