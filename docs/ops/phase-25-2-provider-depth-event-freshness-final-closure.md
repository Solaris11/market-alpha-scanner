# Phase 25.2 - Provider Depth + Event Freshness Final Closure

Date: 2026-05-25

Production target: https://tradeveto.com

Production path: /opt/apps/market-alpha-scanner/app

## Issue Summary

The production provider-source-trust baseline was source-complete but not fully ready. Displayed event cards disclosed provider, source URL, timestamp, freshness, provider state, uncertainty, affected symbols, and watchlist impact, but provider-domain readiness still failed on limited/stale domains.

Baseline artifact:

- `docs/ops/artifacts/phase-25-2/provider-baseline.json`

Baseline status:

- Authenticated probe: pass
- Source completeness: 100%
- Context completeness: 100%
- Certification status: strong-partial
- Overall status: not_ready
- Limited domains: inflation, dividends
- Breached freshness domains: rates, analyst-actions, geopolitical-events
- Unmeasured freshness domains: inflation, dividends
- Outage/fallback/recovery simulation: pass

## Implemented Changes

- Added scanner-level Yahoo Finance dividend calendar extraction from real fundamentals fields:
  - `exDividendDate`
  - `dividendDate`
  - `lastDividendDate`
  - source URL: `https://finance.yahoo.com/quote/{symbol}`
  - provider label: Yahoo Finance Dividend Calendar
- Added source-linked dividend calendar event generation in `scanner/event_intelligence.py`.
- Added a Python regression test proving dividend calendar rows create source-linked events without fabricated headlines.
- Expanded frontend provider-domain freshness governance from a single 6-hour SLA to domain-specific cadences:
  - rates/macro/inflation: 24h
  - geopolitical: 12h
  - analyst actions: 48h
  - earnings/dividends: 30d calendar window
  - crypto: 6h
  - company/sector: 24h
- Broadened inflation domain recognition to include source-linked oil/energy supply shock evidence when reason codes or event text explicitly tie the item to commodity/inflation pressure.
- Kept no-fabrication behavior intact:
  - no generated headlines
  - no fake analyst actions
  - no fake geopolitical events
  - no fake live labels
  - missing provider rows remain limited/outage/stale instead of inferred

## Local Validation

Passed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`
- `.venv/bin/python -m unittest tests.test_event_intelligence.EventIntelligenceTests.test_dividend_calendar_row_creates_source_linked_event_without_fake_headline`

Local caveat:

- `python3 -m pytest tests/test_event_intelligence.py` was not used because the system Python lacks pytest. The repo virtualenv unittest path passed for the new regression.

## Production Workflow

Pending after commit/push:

1. Pull latest `main` on production.
2. Rebuild/redeploy frontend.
3. Rebuild/run scanner job because provider ingestion changed.
4. Run production smoke.
5. Run authenticated provider-source-trust probe.
6. Run provider outage/fallback/recovery simulation.
7. Capture final production artifacts.

## Production Evidence

Pending.

## Remaining Blockers

Pending production probe.

## Verdict

Pending production probe.
