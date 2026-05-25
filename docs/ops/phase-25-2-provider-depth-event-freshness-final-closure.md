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
- Added frontend parsing for scanner-owned Python-literal verified event payloads so structured provider rows are not dropped when the latest scan stores provider event lists as Python repr-style strings.
- Changed market command event selection to preserve provider-domain breadth before filling with repeated high-score event types. This prevents dividend calendar rows from crowding out source-linked geopolitical, inflation, earnings, and economic-calendar evidence.

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

Completed:

1. Pushed implementation commits to `main`:
   - `64cc0eb1` - scanner dividend provider extraction and initial provider freshness governance.
   - `781db065` - parser fallback for scanner provider event payloads.
   - `244826e7` - domain-breadth selection for displayed provider events.
2. Pulled latest `main` on production at `/opt/apps/market-alpha-scanner/app`.
3. Rebuilt/redeployed `market-alpha-frontend`.
4. Rebuilt and ran `market-alpha-scanner-job` after provider ingestion changes.
5. Reran `market-alpha-frontend` rebuild after frontend parser/domain-selection changes.
6. Ran production smoke:
   - `curl -fsS https://tradeveto.com/api/health`
   - `curl -fsS https://tradeveto.com/api/health/deep`
   - `/terminal` 200
   - `/macro` 200
   - `/feed` 200
   - `/market-memory` 200
   - `/symbol/AMD` 200
   - `/scanner` 200
   - `/discover` 200
7. Ran authenticated provider-source-trust probe against `https://tradeveto.com`.
8. Ran provider outage/fallback/recovery simulation through the same authenticated probe.
9. Captured final production artifact:
   - `docs/ops/artifacts/phase-25-2/provider-final.json`

## Production Evidence

Final authenticated provider-source-trust artifact:

- `docs/ops/artifacts/phase-25-2/provider-final.json`

Final production probe result:

- Authenticated probe: pass
- Overall status: not_ready
- Certification status: strong-partial
- Displayed source-linked event cards: 12
- Source completeness: 100%
- Context completeness: 100%
- Hidden stale states: 0
- Fake live labels: 0
- Outage simulation: pass
- Fallback visible: pass
- Recovery visible: pass

Final active freshness domains:

- inflation
- earnings
- economic-calendar
- dividends
- geopolitical-events
- company-events
- sector-events

Final provider/source examples:

- MarketWatch: inflation/geopolitical/economic-calendar source-linked event evidence.
- Yahoo Finance Dividend Calendar: dividend, company-event, and sector-event source-linked calendar evidence.
- Yahoo Finance Earnings Calendar: earnings source-linked calendar evidence.

## Remaining Blockers

The final production probe is still not `ready`.

Remaining limited domains:

- macro
- rates
- analyst-actions

Remaining unmeasured SLA domains:

- macro
- rates
- analyst-actions
- crypto-events

Interpretation:

- TradeVeto now proves source-complete displayed event cards and honest outage/fallback behavior.
- TradeVeto does not yet prove Bloomberg/StockTitan/Yahoo-level breadth across all required domains.
- The system correctly exposes limited/unmeasured states rather than fabricating providers, events, analyst actions, or live labels.

## Verdict

TRADEVETO PROVIDER DEPTH + EVENT FRESHNESS FINAL CLOSURE STRONG PARTIAL ACCOMPLISHED
