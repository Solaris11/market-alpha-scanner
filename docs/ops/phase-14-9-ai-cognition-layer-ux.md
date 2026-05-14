# Phase 14.9 - AI Cognition Layer UX

## Executive Summary

Phase 14.9 adds a deterministic AI cognition layer that shows how TradeVeto's view is changing instead of presenting isolated dashboard cards. The new experience surfaces a reasoning timeline, signal freshness, contradiction checks, narrative evolution, and Copilot-ready questions from structured scanner and workflow packets.

This is not an LLM-authored reasoning layer. It is generated from bounded platform data and keeps the same research-only, non-advisory framing used across TradeVeto.

## What Changed

- Added a new cognition model builder in `frontend/src/lib/trading/ai-cognition-layer.ts`.
- Added a visible `AI Cognition Layer / Thinking Timeline` panel on `/terminal`.
- Added a compact cognition panel on `/symbol/[symbol]`.
- Extended Research Copilot with a `cognition` intent for questions like:
  - "Why did this change?"
  - "What is contradicting this setup?"
  - "What is stale?"
  - "What needs confirmation?"
  - "What changed since yesterday?"
- Added tests covering grounded timeline generation, stale signal detection, contradiction detection, Copilot intent routing, citations, and non-advisory language.

## Reasoning Timeline

The timeline now shows:

- Current market-state baseline.
- Workflow changes from the latest user/session snapshot when available.
- Improving setups.
- Deteriorating setups.
- Aging signals that need freshness confirmation.

The timeline uses real inputs from:

- `WorkflowEvolutionSummary.whatChanged`
- `WorkflowEvolutionSummary.improvingSetups`
- `WorkflowEvolutionSummary.deterioratingSetups`
- `OpportunityViewModel.dataFreshness`
- Current market condition labels

If no prior workflow snapshot exists, the UI says it is a baseline cognition snapshot instead of pretending to know a prior story.

## Confidence Decay

The layer exposes confidence decay through:

- Signal age in minutes.
- Freshness status.
- Last updated timestamp.
- Evidence maturity label and sample count.
- Conviction and fragility context.

Fresh rows are framed as current but still dependent on evidence and risk. Slightly stale or stale rows are explicitly marked as monitor-only research context until newer scan confirmation exists.

## Contradiction Detection

The first deterministic contradiction checks cover:

- High score with low evidence.
- Momentum strength with weak breadth.
- Symbol setup quality while macro alignment is weak.
- Visible setup with elevated downside shock risk.
- Attention-worthy symbol with poor risk/reward.
- Conviction while volatility pressure is high.

Each contradiction includes:

- Symbol.
- Severity.
- Human explanation.
- Evidence lines from real row fields.
- Click-through link to the symbol detail page.

## Narrative Evolution

The narrative section shows:

- How the workflow story changed since the prior snapshot when available.
- What improved.
- What weakened.
- What remains uncertain.

When history is not available, it clearly states that repeated workflow snapshots are needed before the evolution view deepens.

## Copilot Integration

Research Copilot now has a grounded `cognition` intent. It answers cognition questions from:

- Current cognition overview.
- Contradiction packet.
- Confidence decay packet.
- Timeline packet.
- Workflow cognition citation.

The answer path is deterministic and keeps direct action language out. Copilot citations now include an `AI cognition packet` citation with timeline and contradiction counts.

## Trust And Safety

- No fake reasoning is generated.
- No direct buy/sell instruction language is introduced.
- Weak evidence, stale data, and missing workflow history are shown honestly.
- Symbol links are clickable where symbols appear in cognition panels.
- The model is bounded to visible scanner/workflow fields and does not invent prices, news, or probabilities.

## Validation

Local validation completed:

- `cd frontend && npm run lint` - passed.
- `cd frontend && npm test -- --runInBand` - passed, 390 tests.
- `cd frontend && npm run build` - passed.
- `cd frontend && npm audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors.
- `git diff --check` - passed.

Production validation completed from the production host:

- Host: `onsre-node-01`
- User: `sre`
- Path: `/opt/apps/market-alpha-scanner/app`
- Commit deployed: `a54a8e57035d95443a1a5e51262f798a8d04e8a3`
- `git pull --ff-only origin main` - passed.
- `docker compose up -d --build market-alpha-frontend` - passed.
- `market-alpha-frontend` container health - healthy.
- `https://tradeveto.com/api/health` - 200, `ok: true`.
- `https://tradeveto.com/api/health/deep` - 200, DB ok, scanner ok, local backup ok, R2 backup ok.
- `https://tradeveto.com/terminal` - 200.
- `https://tradeveto.com/symbol/AMD` - 200.
- `https://tradeveto.com/api/research/copilot` GET - 405, expected fail-closed behavior for a non-GET Copilot API route.

Note: unauthenticated public HTML does not expose the full premium terminal cognition panel because `/terminal` renders the premium experience only after entitlement checks. Route and container validation passed; interactive premium-session visual QA should be repeated with an authenticated beta user during the next UI smoke pass.

## Remaining Risks

- Timeline depth depends on repeated workflow snapshots; first-time users will see a baseline view.
- Contradiction coverage is intentionally conservative and should expand only when backed by validated fields.
- Copilot cognition answers are deterministic today; deeper LLM synthesis should remain gated behind grounding validation.
- More visual timeline affordances could be added later, but the current implementation prioritizes trust and performance.

## Final Status

AI COGNITION LAYER UX COMPLETE
