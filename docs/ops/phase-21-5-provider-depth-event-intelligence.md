# Phase 21.5 - Provider Depth + Event Intelligence Expansion

Date: 2026-05-23

## Verdict

Local validation complete; production validation pending.

## Implementation Summary

- Expanded scanner verified-event classification for source-linked analyst actions and dividend events.
- Added StockTitan, Nasdaq, Alpaca, Treasury, FRED/St. Louis Fed, and CME Group to trusted provider allowlists/weighting where URLs and source names are verified.
- Added provider feed status capture to the scanner event refresh path:
  - `active`
  - `no_recent_items`
  - `blocked`
  - `outage`
  - `stale_fallback`
  - `partial_outage`
- Added scanner row disclosure fields:
  - `verified_event_feed_status`
  - `verified_event_feed_disclosure`
- Added terminal provider coverage matrix states:
  - `active`
  - `delayed`
  - `stale`
  - `calendar-only`
  - `limited`
  - `outage`
  - `partial-outage`
- Extended provider matrix disclosure to distinguish source-linked provider rows, stored calendar-only data, raw provider outage/error fields, stale provider timestamps, and limited-data states.
- Preserved no-fabrication behavior: missing headlines, events, analyst actions, dividend events, and provider coverage remain labeled as limited/outage/stale instead of inferred.

## Provider Coverage Matrix

The terminal command center now audits these domains:

- Macro
- Inflation
- Rates
- Earnings
- Analyst actions
- Dividends
- Geopolitical events
- Economic calendar
- Company events
- Sector events
- Crypto events

Each domain exposes coverage, operational state, source transparency, freshness, latency disclosure, and limitations.

## Source-Linked Event Intelligence

Accepted event intelligence still requires a trusted source name, source URL, title/headline, and timestamp. New analyst/dividend handling classifies only from provided source text:

- `EVENT_ANALYST_ACTION`
- `EVENT_ANALYST_POSITIVE_ACTION`
- `EVENT_ANALYST_NEGATIVE_ACTION`
- `EVENT_DIVIDEND_CONTEXT`
- `EVENT_DIVIDEND_POSITIVE`
- `EVENT_DIVIDEND_NEGATIVE`

No analyst action or dividend event is generated without source text or stored calendar/fundamental fields.

## Watchlist Impact

The existing watchlist impact engine now benefits from the expanded provider matrix:

- Source-linked developments still prioritize direct watchlist overlap.
- Top opportunity/risk symbols are still considered for indirect priority.
- Provider outage and stale states do not create watchlist events.
- Calendar-only events remain labeled separately from source-linked provider events.

## Local Validation

Completed:

- `.venv/bin/python -m unittest tests.test_event_intelligence` - pass
- `npm --prefix frontend test -- --runInBand frontend/src/lib/trading/daily-market-command.test.ts frontend/src/lib/trading/verified-event-intelligence.test.ts` - pass
- `npm --prefix frontend test -- --runInBand` - pass
- `npm --prefix frontend run lint` - pass
- `npm --prefix frontend run build` - pass
- `npm --prefix frontend audit --omit=dev` - pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - pass
- `npx pyright . --pythonpath .venv/bin/python --warnings` - pass, 0 errors / 0 warnings / 0 informations
- `git diff --check` - pass

Notes:

- `python3 -m pytest tests/test_event_intelligence.py` was not usable because `pytest` is not installed in the system Python environment; the repository-compatible `.venv` unittest command above passed.

## Production Validation

Pending:

- Commit and push to `main`
- Production pull
- Production container rebuild/redeploy
- Production smoke
- Production artifact update

## Remaining Blockers

- Final production validation has not been completed yet.
