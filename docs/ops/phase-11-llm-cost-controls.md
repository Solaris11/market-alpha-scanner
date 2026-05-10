# Phase 11.8 LLM Cost Controls

## Usage map

Live OpenAI calls are intentionally limited to four surfaces:

- `scanner/event_llm.py`: verified event classification during feed refresh. Guarded by `TRADEVETO_EVENT_LLM_MAX_CALLS_PER_REFRESH`.
- `frontend/scripts/narrative-refresh.ts`: scheduled narrative summaries for top symbols. Guarded by `TRADEVETO_NARRATIVE_LLM_TOP_N`.
- `frontend/src/lib/server/opportunity-llm.ts`: premium risk-tolerant opportunity explanation.
- `frontend/src/lib/server/research-copilot-llm.ts`: premium research copilot answers.

Symbol pages, shock cards, replay, portfolio/scenario panels, and dashboards use deterministic/cached outputs unless one of the surfaces above is explicitly called.

## Budget policy

Application LLM calls use:

- `llm_response_cache` for validated response reuse.
- `llm_usage_events` for per-call audit history.
- `llm_usage_daily` for daily global, route, surface, and user budget accounting.
- process-local fallback accounting if the cost-control tables are temporarily unavailable.

Default budget environment:

```bash
TRADEVETO_LLM_BUDGET_ENFORCEMENT=true
TRADEVETO_LLM_DAILY_USD_BUDGET=25
TRADEVETO_LLM_USER_DAILY_USD_BUDGET=1.5
TRADEVETO_LLM_ROUTE_DAILY_USD_BUDGET=8
TRADEVETO_LLM_SURFACE_DAILY_USD_BUDGET=10
TRADEVETO_LLM_EST_INPUT_USD_PER_1M=2
TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M=10
TRADEVETO_LLM_RESPONSE_CACHE_TTL_SECONDS=43200
TRADEVETO_LLM_FALLBACK_MODEL=
```

The price values are spend estimates for guardrails, not provider billing exports. Update them when the active OpenAI model pricing changes.

## Failure behavior

When a budget is exceeded, a timeout happens, OpenAI is unavailable, output fails grounding validation, or cache writes fail, TradeVeto falls back to deterministic explanations. No page render should require a live LLM response.

## Operator visibility

Admin monitoring now shows:

- estimated LLM spend today
- LLM calls today
- cache hits
- blocked calls
- cost by surface
- recent LLM events

## Remaining risks

- Spend estimates depend on configured token prices and should be reconciled against OpenAI billing.
- The Python event classifier has a per-refresh call cap but does not write to the app-side `llm_usage_daily` tables.
- Multi-instance enforcement is DB-backed for app routes; if the DB budget tables are unavailable, the fallback guard is process-local.
