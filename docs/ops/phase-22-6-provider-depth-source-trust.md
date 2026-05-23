# Phase 22.6 Provider Depth + Source Trust Expansion

Date: 2026-05-23

## Scope

Phase 22.6 added a source-trust certification contract for displayed market event cards and a production probe endpoint for provider-depth evidence.

Implemented:

- Source-trust card completeness metrics for provider, source URL, timestamp, freshness, affected symbols, watchlist impact disclosure, and uncertainty.
- Provider coverage matrix proof for macro, rates, inflation, earnings, analyst actions, dividends, geopolitical events, company events, sector events, and crypto events.
- Visible provider operational states: active, delayed, stale, outage, partial outage, calendar-only, and limited.
- Authenticated production route: `/api/intelligence/provider-source-trust`.
- Production probe script: `npm --prefix frontend run probe:phase22:provider-source-trust`.
- Header-based production-safe outage simulation for provider fallback/recovery visibility.

## Local Validation

Completed:

- `npm --prefix frontend run lint` passed.
- `npm --prefix frontend test -- --runInBand` passed, 483 tests.
- `npm --prefix frontend run build` passed.
- `npm --prefix frontend audit --omit=dev` passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` passed, 0 errors.
- `git diff --check` passed.
- `node --check frontend/scripts/phase22-provider-source-trust-probe.mjs` passed.

## Production Evidence

Pending production deployment and probe run.

## Remaining Blockers

Pending production evidence. Certification cannot be marked accomplished until the production probe proves the 95% source-card target and honest provider state/outage behavior on live data.
