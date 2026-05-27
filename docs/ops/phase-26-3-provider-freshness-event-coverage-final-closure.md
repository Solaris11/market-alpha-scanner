# Phase 26.3 - Provider Freshness + Event Coverage Final Closure

Date: 2026-05-27

## Verdict

TRADEVETO PROVIDER FRESHNESS + EVENT COVERAGE FINAL CLOSURE STRONG PARTIAL ACCOMPLISHED

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
  - crypto-events: 48 hours
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

## Production Deploy Proof

Production host: `sre@100.68.155.121`

Production path: `/opt/apps/market-alpha-scanner/app`

Deployed commit: `6a8d83ab`

Commands completed:

- `git pull --ff-only origin main`
- `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`

Production container health:

- `market-alpha-frontend`: healthy
- `market-alpha-frontend-hot-api`: healthy

Production smoke:

| Check | Result |
| --- | --- |
| `https://tradeveto.com/api/health` | Pass |
| `https://tradeveto.com/api/health/deep` | Pass |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/market-memory` | 200 |
| `/symbol/AMD` | 200 |
| `/alerts` | 200 |
| `/feed` | 200 |
| `/macro` | 200 |

## Production Provider Trust Proof

Artifacts:

- `docs/ops/artifacts/phase-26-3-provider-trust/source-trust-probe.json`
- `docs/ops/artifacts/phase-26-3-provider-trust/provider-matrix.json`
- `docs/ops/artifacts/phase-26-3-provider-trust/freshness-sla-proof.json`
- `docs/ops/artifacts/phase-26-3-provider-trust/outage-simulation-proof.json`
- `docs/ops/artifacts/phase-26-3-provider-trust/domain-timelines.json`
- Production-only raw payload: `docs/ops/artifacts/phase-26-3-provider-trust/source-trust-api-payload.json`

Provider-source-trust probe summary:

| Metric | Result |
| --- | --- |
| Authenticated probe | Pass |
| `overallStatus` | `not_ready` |
| certification status | `strong-partial` |
| displayed event cards | 16 |
| source completeness | 100% |
| context completeness | 100% |
| fake live labels | 0 |
| hidden stale states | 0 |
| outage simulation | Pass |
| outage fallback visible | Pass |
| outage recovery visible | Pass |

Provider domain matrix:

| Domain | State | SLA Status | Provider Evidence |
| --- | --- | --- | --- |
| macro | active | within-sla | SEC EDGAR 8-K Filings, MarketWatch |
| rates | active | within-sla | SEC EDGAR 8-K Filings |
| inflation | active | within-sla | MarketWatch |
| earnings | active | within-sla | MarketWatch |
| economic-calendar | active | within-sla | SEC EDGAR 8-K Filings, MarketWatch |
| analyst-actions | limited | not-measured | No source-linked analyst-action row in production probe |
| dividends | active | within-sla | Yahoo Finance Dividend Calendar |
| geopolitical-events | limited | not-measured | No source-linked geopolitical row selected in production probe |
| company-events | active | within-sla | SEC EDGAR 8-K Filings, MarketWatch, Yahoo Finance Dividend Calendar, CoinDesk |
| sector-events | active | within-sla | SEC EDGAR 8-K Filings, MarketWatch, Yahoo Finance Dividend Calendar, CoinDesk |
| crypto-events | active | within-sla | CoinDesk |

Event-domain timeline proof:

- Production raw payload returned 9 event-domain timelines.
- Timeline coverage passed in the certification model.
- Derived timeline artifact is stored in `domain-timelines.json`.

Outage governance proof:

- Simulated outage domains: news, macro, scanner.
- Fallback states were visible.
- Recovery states were visible.
- Outage disclosures explicitly avoided fake live labels or inferred missing events.

## Remaining Blockers

Full accomplishment is not defensible yet because production still lacks source-linked rows for:

- analyst-actions
- geopolitical-events

Those domains remain limited with unmeasured freshness SLAs. This is the correct no-fabrication outcome: TradeVeto exposes the missing coverage instead of inventing analyst actions, geopolitical events, providers, headlines, or live status.
