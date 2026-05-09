# Phase 8.5 LLM Grounding + Evaluation Harness

Phase 8.5 adds deterministic validation around TradeVeto LLM explanation layers. The LLM remains an explanation layer only; deterministic scanner, event, shock, narrative, and opportunity scores remain the source of truth.

## Covered LLM Surfaces

- Verified event interpretation (`scanner/event_llm.py`)
- Narrative refresh explanations (`frontend/scripts/narrative-refresh.ts`)
- Risk-tolerant opportunity explanations (`frontend/src/lib/server/opportunity-llm.ts`)
- Conversational research copilot answers (`frontend/src/lib/server/research-copilot-llm.ts`)
- Shock/opportunity explanation fixtures through the shared eval harness

## Shared Metrics

The TypeScript harness in `frontend/src/lib/trading/llm-grounding.ts` returns:

- `groundednessScore`
- `schemaValidity`
- `unsupportedClaimsDetected`
- `staleDataDisclosure`
- `forbiddenLanguageDetected`
- `inventedPriceDetected`
- `inventedProbabilityDetected`
- `inventedNewsDetected`
- `unsupportedMacroClaimsDetected`
- `deterministicOverrideDetected`
- `safeForUse`

If `safeForUse` is false, the LLM output is rejected and deterministic fallback copy is used.

## Guardrails

The evaluator rejects:

- invented price/target/entry/exit claims not present in structured inputs
- invented probability or win-rate claims
- invented news/event claims when no verified event packet supports them
- unsupported macro certainty such as “Fed will...” or “market will...”
- direct financial advice or “buy now/sell now” language
- attempts to override deterministic scanner scores or decisions
- stale-data packets that do not disclose stale or limited data

## OpenAI Request Safety

OpenAI request payload tests verify:

- model IDs such as `gpt-5.5` are passed through as configured
- request payloads do not include API secrets
- no unsupported `temperature` override is sent
- timeout values are bounded

## Test Fixtures

The test suite includes:

- valid structured packet
- stale structured packet
- contradictory deterministic evidence
- missing event data with invented news
- high-risk shock setup
- AMD vs MU symbol comparison
- macro conflict scenario
- event LLM grounded/ungrounded outputs

