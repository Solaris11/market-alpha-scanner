# Sprint 32.2 - Platform Moat Construction

## Objective

Create durable, evidence-backed advantages that competitors cannot easily replicate:

- Market Memory Graph relationships between symbols, events, macro drivers, earnings/event reactions, and historical outcomes
- User Intelligence Graph relationships between authenticated user interests, research behavior, workflows, sector preferences, and signal preferences
- Opportunity Knowledge Graph relationships between scanner signals, market environments, predictive state, and outcome memory
- Unique signal engines: memory-adjusted, cross-sector intelligence, behavioral opportunity, and multi-event intelligence
- Defensibility analysis across data uniqueness, workflow uniqueness, AI uniqueness, and replication difficulty

## Trust Boundary

Platform Moat is a defensibility model built from TradeVeto's own source-backed scanner, market-memory, user-workflow, predictive, macro, event, and outcome evidence.

It does not claim:

- competitors can never copy visible product features
- permanent monopoly
- guaranteed competitive immunity
- fabricated user behavior
- fabricated market outcomes
- fabricated events, providers, or catalysts

## Implementation Summary

Implemented locally:

- `frontend/src/lib/trading/platform-moat.ts`
  - builds Market Memory Graph, User Intelligence Graph, Opportunity Knowledge Graph, unique signal engines, defensibility scores, and certification status
- `frontend/src/app/api/intelligence/platform-moat/route.ts`
  - premium authenticated API endpoint combining scanner, market memory, personalization, workflow evolution, portfolio, live intelligence, regime, and predictive systems
- `frontend/src/components/terminal/PlatformMoatPanel.tsx`
  - terminal panel exposing moat score, proprietary dataset count, unique signal count, graph relationship counts, and proof boundary
- `frontend/src/app/terminal/page.tsx`
  - renders Platform Moat panel after Predictive Intelligence
- `frontend/src/lib/trading/platform-moat.test.ts`
  - unit coverage for graph readiness, bounded moat claims, and insufficient-evidence failure
- `frontend/scripts/sprint32-2-platform-moat-probe.mjs`
  - authenticated production proof probe with temporary premium/admin probe user, watchlist, risk profile, and paper positions
- `frontend/package.json`
  - `probe:sprint32:platform-moat`
  - `probe:sprint32:platform-moat:docker`

## Local Validation

Passed locally on 2026-05-30:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 564 passed
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

## Production Deployment

Pending.

Production workflow:

- `git pull --ff-only origin main`
- `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- smoke `/api/health`, `/api/health/deep`, `/terminal`
- run `npm --prefix frontend run probe:sprint32:platform-moat:docker`

## Certification Evidence

Expected production proof artifact:

- `docs/ops/artifacts/sprint-32-2-platform-moat/platform-moat-proof.json`

Proof gates:

- `/terminal` renders Platform Moat panel
- `/api/intelligence/platform-moat` returns `ok=true`
- certification `overallStatus=ready`
- proprietary datasets `>= 3`
- unique signals `>= 4`
- Market Memory Graph relationships `>= 8`
- User Intelligence Graph relationships `>= 3`
- Opportunity Knowledge Graph relationships `>= 20`
- moat score `>= 70`
- no unsupported monopoly/certainty language

## Current Verdict

TRADEVETO PLATFORM MOAT CONSTRUCTION NOT ACCOMPLISHED
