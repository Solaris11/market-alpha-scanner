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

Production proof captured:

- `docs/ops/artifacts/phase-34-3-provider-freshness/provider-reliability-proof.json`

## Production Deployment

- Commit deployed: `60f78f0`
- Production pull: complete
- Rebuilt containers: `market-alpha-frontend`, `market-alpha-frontend-hot-api`
- Container status: both healthy
- `/api/health`: pass
- `/api/health/deep`: pass

## Production Provider Proof

Run time: `2026-06-02T04:56:01.500Z`

Summary:

- Authenticated route covered: yes
- Baseline samples: 3
- Success rate: 100%
- Failure rate: 0%
- Latency samples: 6800 ms, 6761 ms, 6845 ms
- p50: 6800 ms
- p95: 6845 ms
- Source trust: pass
- Source completeness: 100%
- Context completeness: 100%
- Outage simulation: fallback visible and recovery visible

Rates SLA:

- Status: restored
- Domain state: active
- SLA status: within-sla
- Age: 456 minutes
- SLA: 1440 minutes
- Provider: SEC EDGAR 8-K Filings, U.S. Treasury
- Disclosure: Rates source-linked provider row is 456m old against a 1440m freshness SLA.

Provider domain audit:

- macro: within-sla
- rates: within-sla
- inflation: within-sla
- earnings: within-sla
- economic-calendar: within-sla
- analyst-actions: within-sla
- dividends: within-sla
- geopolitical-events: within-sla
- company-events: within-sla
- sector-events: within-sla
- crypto-events: limited / not-measured

## Remaining Blockers

Provider readiness is not fully certified because `crypto-events` remains limited and freshness SLA is unmeasured. This is not a rates blocker, but it prevents the provider-source-trust certification from returning `ready`.

## Current Verdict

TRADEVETO PROVIDER FRESHNESS RECOVERY STRONG PARTIAL ACCOMPLISHED

Reason: the Phase 33 rates SLA blocker is recovered with source-linked U.S. Treasury evidence, source trust is passing, and outage fallback/recovery proof passes. Full provider readiness is not certified because crypto-event coverage remains limited/not-measured.
