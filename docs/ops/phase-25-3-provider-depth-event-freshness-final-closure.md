# Phase 25.3 - Provider Depth + Event Freshness Final Closure

Date: 2026-05-24
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO PROVIDER DEPTH + EVENT FRESHNESS FINAL CLOSURE STRONG PARTIAL ACCOMPLISHED

This phase tightens source-linked event trust and freshness governance without fabricating providers, events, headlines, analyst actions, geopolitical events, or live labels. It is not marked fully accomplished because the authenticated production probe still shows limited provider domains and breached freshness SLAs. It is marked strong partial because production now proves 100% source/context completeness on displayed event cards, visible outage/recovery proof, no hidden stale state, and no fake live labels.

## Implemented Changes

- Source trust hardening:
  - Raised displayed event-card source completeness target from 95% to 99%.
  - Made `uncertainty` a required event-card source-trust field, not just optional context.
  - Added `targetCompletenessPct` to source-trust summaries so probes can enforce the current gate.
- Provider matrix and timelines:
  - Added `economic-calendar` to the required provider-domain proof set.
  - Added an economic-calendar event-domain timeline.
  - Expanded event-domain timeline output so configured domains are not dropped by the previous eight-timeline cap.
- Watchlist impact engine:
  - Event cards now expose explicit confidence, macro impact, replay linkage, and strategy linkage labels.
  - Strategy linkage remains research-only and does not imply allocation changes, broker state, fills, or returns.
- Outage and recovery governance:
  - Added a provider freshness certification summary to `/api/intelligence/provider-source-trust`.
  - Certification checks source completeness, required domains, freshness SLAs, timeline coverage, hidden stale states, fake live labels, and outage fallback/recovery proof.
  - Probe strictness now uses a 99% source-trust target and records the certification summary.
- UI trust visibility:
  - Daily Market Command event overlays now expose confidence, macro impact, replay linkage, and strategy linkage alongside provider state, freshness, SLA, source URL, timestamp, and uncertainty.

## Required Provider Domains

| Domain | Expected behavior |
| --- | --- |
| Macro | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Rates | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Inflation | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Earnings | Source-linked or calendar-only with measured disclosure |
| Economic calendar | Calendar/source-linked visibility with freshness disclosure |
| Analyst actions | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Dividends | Source-linked or calendar-only with measured disclosure |
| Geopolitical events | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Company events | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Sector events | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |
| Crypto events | Source-linked provider row with freshness SLA, or explicit limited/stale/outage state |

## No-Fabrication Guardrails

- No fake events.
- No fake headlines.
- No fake providers.
- No fake analyst actions.
- No fake geopolitical events.
- No fake live labels.
- Limited, stale, delayed, partial-outage, and outage states stay visible when provider proof is incomplete.

## Local Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 505 tests |
| `npm --prefix frontend test -- provider-source-certification.test.ts daily-market-command.test.ts --runInBand` | Pass, 505 tests after certification false-positive fix |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `node --check frontend/scripts/phase22-provider-source-trust-probe.mjs` | Pass |
| `git diff --check` | Pass |

## Production Deployment

| Check | Result |
| --- | --- |
| Initial implementation commit | `4babc034` |
| Certification false-positive fix commit | `0bf25f8a` |
| Production pull | Pass, fast-forwarded production to `0bf25f8` |
| Frontend rebuild/redeploy | Pass, `docker compose --env-file .env up -d --build market-alpha-frontend` |
| Production frontend health | Pass, `market-alpha-frontend` healthy |

## Production Smoke

| Route | Result |
| --- | --- |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/terminal` | 200 |
| `/macro` | 200 |
| `/feed` | 200 |
| `/market-memory` | 200 |
| `/symbol/AMD` | 200 |
| `/scanner` | 200 |
| `/discover` | 200 |

## Production Provider-Source-Trust Probe

Artifact:

- `docs/ops/artifacts/phase-25-3/provider-freshness-production.json`

Command:

- `npm run probe:phase25:provider-freshness` inside the production `market-alpha-frontend` container.

Summary:

| Metric | Result |
| --- | --- |
| Authenticated premium probe identity | Pass, created and cleaned up |
| Baseline status code | 200 |
| Baseline latency | 2149 ms |
| Displayed event cards | 11 |
| Source completeness | 100% |
| Context completeness | 100% |
| Certification status | `strong-partial` |
| Overall probe status | `not_ready` |
| Outage simulation | Pass, fallback and recovery visible |
| Hidden stale-state count | 0 |
| Fake live-label count | 0 |

Provider state counts:

| State | Count |
| --- | ---: |
| active | 8 |
| limited | 3 |
| delayed | 0 |
| stale | 0 |
| outage | 0 |
| partial-outage | 0 |
| calendar-only | 0 |

Freshness SLA status counts:

| State | Count |
| --- | ---: |
| within-sla | 4 |
| breached | 4 |
| not-measured | 3 |

Strong partial proof:

- 11 of 11 displayed source-linked event cards disclose provider, source URL, timestamp, freshness, provider state, uncertainty, affected symbols, and watchlist impact.
- Economic-calendar coverage is now part of the required domain matrix and passed within the 1440m SLA in production.
- Outage simulation exposed visible fallback and recovery states.
- The corrected fake-live detector reports `fakeLiveLabelCount: 0`.
- The stale-state detector reports `hiddenStaleStateCount: 0`.
- Event-domain timeline coverage reports no missing configured-domain timelines.

Production blockers:

- Limited provider domains: macro, inflation, dividends.
- Freshness SLA breached: rates, analyst-actions, geopolitical-events, crypto-events.
- Freshness SLA unmeasured: macro, inflation, dividends.

## Remaining Blockers

- Bloomberg/StockTitan/Yahoo-level breadth is not claimed without active, source-linked production coverage across required domains.
- Full accomplishment requires production source completeness >= 99%, freshness SLAs passing, no limited required provider domains, visible outage/recovery proof, and no fake live/stale-state regressions.
- Dedicated macro, inflation, and dividend source-linked providers are still insufficient in the production packet.
- Rates, analyst-actions, geopolitical, and crypto provider rows must refresh inside their 360m SLA to pass full certification.
