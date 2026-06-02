# Phase 34.3 - Provider Freshness Recovery

## Objective

Phase 33 marked provider freshness as a critical blocker because the rates provider domain breached freshness SLA. This sprint focuses on restoring source-linked rates freshness, making freshness/degradation visible, and producing repeatable provider reliability proof.

## Implementation Summary

- Added official U.S. Treasury daily yield-curve ingestion to supplemental provider coverage.
- Added rates domain selection so rates proof does not depend on stale incidental filings.
- Added an authenticated provider freshness dashboard object to `/api/intelligence/provider-source-trust`.
- Added a Phase 34.3 provider reliability probe that measures availability, latency, failure rate, rates SLA, source-trust completeness, and outage fallback/recovery.

## Provider Audit Scope

Required domains:

- macro
- rates
- inflation
- earnings
- economic-calendar
- analyst-actions
- dividends
- geopolitical-events
- company-events
- sector-events
- crypto-events

The certification requires source-linked provider rows, visible provider state, visible freshness/SLA state, source URLs, timestamps, uncertainty, and no fake live labels.

## Automatic Degradation

When a provider domain is delayed, stale, breached, outage, partial-outage, calendar-only, or limited:

- the provider state remains visible
- freshness age remains visible
- confidence is reduced through freshness-limited copy
- stale/live claims are blocked by the existing provider certification checks
- certification remains blocked until source freshness and coverage recover

## Freshness Dashboard

The authenticated provider source-trust endpoint now returns `freshnessDashboard`:

- domain-level age and SLA state
- provider availability
- operational state
- fallback activation
- degraded mode frequency
- outage event count
- rates SLA status
- readiness status

## Validation Commands

Local validation:

```bash
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
git diff --check
```

Production provider proof:

```bash
npm --prefix frontend run probe:phase34:provider-freshness:docker
```

## Evidence Inventory

Artifact folder:

```text
docs/ops/artifacts/phase-34-3-provider-freshness/
```

Expected production proof:

- `provider-reliability-proof.json`

## Current Verdict

Pending production deployment and provider freshness proof.
