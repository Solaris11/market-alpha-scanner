# Sprint 32.1 - Predictive Intelligence Engine

## Objective

Move TradeVeto from descriptive intelligence toward bounded predictive intelligence:

- market regime forecasting
- opportunity forecasting
- predictive alert ranking
- authenticated portfolio forecasting
- confidence, evidence, historical validation, and uncertainty disclosure

## Trust Boundary

Predictive Intelligence is probabilistic research context only. It does not guarantee outcomes, provide financial advice, invent events, fabricate catalysts, or override source-backed scanner, regime, portfolio, and live-intelligence evidence.

Every forecast must expose:

- confidence score and confidence band
- supporting evidence
- historical validation state
- uncertainty score and drivers
- research-only boundary language

## Implementation Summary

Implemented locally:

- `frontend/src/lib/trading/predictive-intelligence.ts`
  - deterministic predictive engine
  - market regime forecast
  - opportunity forecast ranking
  - predictive alert ranking
  - portfolio stress forecast
  - confidence framework
  - certification status and blockers
- `frontend/src/app/api/intelligence/predictive/route.ts`
  - premium authenticated endpoint
  - composes scanner, performance, watchlist, paper portfolio, scenario, live, and regime systems
- `frontend/src/components/terminal/PredictiveIntelligencePanel.tsx`
  - visible terminal panel for forecasts and trust boundary
- `frontend/scripts/sprint32-1-predictive-intelligence-probe.mjs`
  - authenticated production probe with probe user, watchlist, and paper positions
- `frontend/src/lib/trading/predictive-intelligence.test.ts`
  - unit coverage for operational forecasts, limited states, watchlist priority, and no-fabrication language
- `frontend/package.json`
  - `probe:sprint32:predictive-intelligence`

## Local Validation

Passed on 2026-05-30:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 561 passed
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

## Production Workflow

Pending deployment:

1. Commit and push to `main`.
2. Production pull in `/opt/apps/market-alpha-scanner/app`.
3. Rebuild `market-alpha-frontend` and `market-alpha-frontend-hot-api`.
4. Run production smoke.
5. Run `npm --prefix frontend run probe:sprint32:predictive-intelligence`.
6. Store proof JSON in `docs/ops/artifacts/sprint-32-1-predictive-intelligence/predictive-intelligence-proof.json`.

## Certification Evidence

Pending production proof.

Expected proof checks:

- `/terminal` renders Predictive Intelligence panel.
- `/api/intelligence/predictive` returns `ok=true`.
- market regime forecast exists with evidence.
- opportunity forecasts are ranked.
- predictive alerts are ranked.
- authenticated portfolio forecast is operational with probe positions.
- confidence framework exposes trust boundary.
- payload avoids guaranteed outcome or direct-action certainty language.

## Current Verdict

Pending production deployment and probe.
