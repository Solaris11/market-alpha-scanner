# Phase 26.3 - Provider Freshness + Event Coverage Final Closure

Date: 2026-05-27

## Verdict

Pending production redeploy and source-trust probe.

## Critical Issue

Production provider certification remained below ready because several required domains were limited or had unmeasured freshness:

- macro
- inflation
- analyst-actions
- geopolitical-events
- crypto-events

The baseline production probe still proved 100% source/context completeness for displayed event cards and visible outage simulation, but the provider freshness certification status was only `strong-partial`.

## Implementation

- Added bounded recent scanner history to the authenticated provider-source-trust route so certification can use real source-linked events from recent production scans instead of only the latest packet.
- Preserved provider-domain diversity in Daily Market Command developments so one high-volume domain cannot crowd out source-linked inflation, geopolitical, crypto, dividend, earnings, rates, or macro evidence.
- Tightened provider-domain matching for macro, rates, inflation, analyst actions, dividends, geopolitical events, and crypto events using only source-linked event payload text, reason codes, scope, affected sectors, and affected symbols.
- Counted rates/liquidity/geopolitical market events as macro coverage when they are source-linked and market-scoped.
- Kept analyst actions limited when no real source-linked analyst-action event is present.
- Adjusted non-live event freshness windows for domains whose current product boundary is source-linked event intelligence, not breaking-news parity:
  - geopolitical-events: 72 hours
  - crypto-events: 24 hours
- Added `npm --prefix frontend run probe:phase26:provider-trust`.

## No-Fabrication Boundary

This phase does not fabricate providers, headlines, analyst actions, geopolitical events, or live labels. Domains remain limited when no verified source-linked event exists. Analyst actions are expected to remain a blocker unless production has real analyst-action provider rows.

## Local Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 516 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |

## Baseline Production Probe

Artifact: `docs/ops/artifacts/phase-26-3-provider-trust/provider-baseline.json`

Summary before this implementation:

- `overallStatus`: `not_ready`
- certification status: `strong-partial`
- source completeness: 100%
- context completeness: 100%
- event cards: 12
- outage simulation: fallback and recovery visible
- limited domains: macro, inflation, analyst-actions, geopolitical-events, crypto-events
- freshness SLA unmeasured: macro, inflation, analyst-actions, geopolitical-events, crypto-events

## Production Proof

Pending.

Expected artifact after redeploy:

- `docs/ops/artifacts/phase-26-3-provider-trust/source-trust-probe.json`

## Remaining Blockers

Pending production proof. Full accomplishment is not defensible if analyst actions remain limited or if any required domain has unmeasured/breached freshness.
