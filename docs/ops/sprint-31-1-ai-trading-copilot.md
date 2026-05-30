# Sprint 31.1 - AI Trading Copilot

## Verdict

Pending production certification.

## Implementation Summary

- Upgraded the existing grounded research copilot into an AI Trading Copilot surface on `/terminal`.
- Added deterministic natural-language market search for:
  - symbol movement questions
  - AI/sector/opportunity screens
  - watchlist-aware screens
  - similar-symbol questions
  - earnings, macro, and risk-filtered queries
- Added symbol movement explanation fields:
  - price movement
  - technical change
  - volume change
  - event context
  - macro context
- Added research-only opportunity actions:
  - high-confidence setup review
  - watchlist candidate review
  - risk-reduction review
  - portfolio pressure review
- Added conversation and personalization memory:
  - watchlist symbols
  - favorite sectors
  - prior questions
  - risk/reward profile context
- Added traceability output for every answer so claims map back to scanner, market-search, watchlist, portfolio, or profile packets.
- Kept the LLM path bounded: if enabled, LLM output is still validated and enriched with deterministic market-search/actions/traceability fields.

## Changed Files

- `docs/ops/sprint-31-1-ai-trading-copilot.md`
- `docs/ops/artifacts/sprint-31-1-ai-trading-copilot/.gitkeep`
- `frontend/package.json`
- `frontend/scripts/sprint31-1-ai-trading-copilot-probe.mjs`
- `frontend/src/components/terminal/ConversationalResearchCopilotPanel.tsx`
- `frontend/src/lib/server/research-copilot-llm.ts`
- `frontend/src/lib/trading/ai-trading-copilot.ts`
- `frontend/src/lib/trading/research-copilot.ts`
- `frontend/src/lib/trading/research-copilot.test.ts`

## Capability Matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| Natural language market search | Implemented | `buildAICopilotMarketSearch` parses question intent and ranks current scanner rows. |
| Symbol questions | Implemented | `symbol_explanation` intent explains price, technical, volume, event, and macro context. |
| Sector/theme questions | Implemented | AI, crypto, macro, and sector keyword matching rank current rows. |
| Portfolio questions | Implemented | Existing portfolio intelligence is included with portfolio citations and research actions. |
| Macro questions | Implemented | Existing regime and intraday packets remain in context and citations. |
| Earnings questions | Implemented | Earnings/guidance context is matched only from verified event/scanner fields. |
| Watchlist questions | Implemented | Watchlist symbols inform market search, personalization, and traceability. |
| Opportunity copilot | Implemented | Research-only action plan is generated from ranking, fragility, and portfolio context. |
| Conversation memory | Implemented | Recent questions, watchlist symbols, sectors, and user risk profile are included. |
| Trust boundary | Implemented | Forbidden direct-action/certainty language is scrubbed or rejected. |

## Trust Boundary

- No fabricated market claims.
- No hallucinated earnings data.
- No invented catalysts, providers, or source URLs.
- No autonomous trading or broker execution.
- No direct `buy now` or `sell now` instructions.
- Opportunity actions are research workflow prompts only.
- If a price, technical, volume, event, or portfolio field is unavailable, the copilot shows a limited state instead of inventing it.

## Local Validation

Pending.

## Production Deployment

Pending.

## Production Smoke

Pending.

## AI Copilot Certification Proof

Pending.

## Remaining Blockers

- Production certification is pending until the authenticated copilot probe runs after deploy.
