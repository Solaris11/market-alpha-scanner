# Phase 25.3 - Provider Depth + Event Freshness Final Closure

Date: 2026-05-24
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

Pending production deployment and provider-source-trust probe.

This phase tightens source-linked event trust and freshness governance without fabricating providers, events, headlines, analyst actions, geopolitical events, or live labels. Full closure still requires production proof that all required provider domains are source-linked, freshness SLAs pass, outage/recovery states are visible, and event cards meet 99% source completeness.

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
| `npm --prefix frontend test -- --runInBand` | Pass, 504 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `node --check frontend/scripts/phase22-provider-source-trust-probe.mjs` | Pass |
| `git diff --check` | Pass |

## Production Deployment

Pending.

## Production Smoke

Pending.

## Production Provider-Source-Trust Probe

Pending.

Expected artifact:

- `docs/ops/artifacts/phase-25-3/provider-freshness-production.json`

## Remaining Blockers

- Production provider-source-trust proof has not run for this phase yet.
- Bloomberg/StockTitan/Yahoo-level breadth is not claimed without active, source-linked production coverage across required domains.
- Full accomplishment requires production source completeness >= 99%, freshness SLAs passing, no limited required provider domains, visible outage/recovery proof, and no fake live/stale-state regressions.
