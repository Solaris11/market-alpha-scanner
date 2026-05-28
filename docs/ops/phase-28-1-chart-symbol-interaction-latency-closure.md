# Phase 28.1 - Chart + Symbol Interaction Latency Closure

Date: 2026-05-28
Target: https://tradeveto.com
Production commit: `8b41ad4`
Status: Strong partial accomplished. The browser proof is now focused, repeatable, and cross-browser, and two Chromium workflow targets pass. Full certification is blocked by remaining symbol route, chart restore, symbol switch, and WebKit/Firefox latency failures.

## Scope

Phase 28.1 targeted the chart and symbol workflows called out by Phase 27.5/27.6:

- Chart workspace restore target: `<250 ms`
- Fullscreen chart open target: `<150 ms`
- Chart toolbar interaction target: `<60 ms`
- Symbol switch target: `<150 ms`
- Symbol search open target: `<100 ms`
- `/symbol/AMD` interactive target: `<2500 ms` in Chromium, Firefox, and WebKit

This phase did not remove chart functionality, hide intelligence content, or replace real workflows with placeholders.

## Implemented Changes

Changed files:

- `frontend/src/components/terminal/chart-workflow-storage.ts`
- `frontend/src/components/terminal/SymbolChart.tsx`
- `frontend/src/components/symbol/SymbolCommandSearch.tsx`
- `frontend/scripts/phase27-full-platform-performance-probe.mjs`
- `frontend/scripts/phase28-chart-symbol-latency-probe.mjs`
- `frontend/package.json`

Implemented behavior:

- Added an in-memory parsed chart workspace cache to avoid repeated JSON parsing during chart restore.
- Opened symbol command search immediately, then hydrated index/results after the overlay shell is visible.
- Added browser-side workflow metrics for chart restore, fullscreen chart open, chart toolbar interaction, symbol switch, and symbol search open.
- Deferred chart workspace application and account sync onto idle work so the chart shell can become visible first.
- Deferred non-critical fullscreen chart workstation panels until after fullscreen shell readiness.
- Added visible chart previous/next symbol controls for a repeatable production symbol-switch probe.
- Added a focused Phase 28.1 production browser probe:
  - Chromium
  - Firefox
  - WebKit
  - authenticated temporary probe identity
  - production screenshot capture
  - Playwright trace capture
  - timing JSON output

## Local Validation

Local validation completed after the runtime changes:

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 531 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass |
| `git diff --check` | Pass |

## Production Deployment

Production workflow completed:

- Pulled `main` on `/opt/apps/market-alpha-scanner/app`.
- Rebuilt and restarted:
  - `market-alpha-frontend`
  - `market-alpha-frontend-hot-api`
- Verified production commit `8b41ad4`.

Production smoke passed after deploy:

| Route | HTTP |
| --- | ---: |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/symbol/AMD` | 200 |
| `/symbol/NVDA` | 200 |
| `/history` | 200 |
| `/performance` | 200 |
| `/alerts` | 200 |
| `/feed` | 200 |
| `/macro` | 200 |
| `/market-memory` | 200 |

## Production Browser Proof

Probe command:

```bash
npm --prefix frontend run probe:phase28:chart-symbol-latency
```

Production artifact root:

- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/phase28-chart-symbol-latency.json`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/screenshots/chromium/symbol-workflow.png`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/screenshots/firefox/symbol-workflow.png`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/screenshots/webkit/symbol-workflow.png`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/traces/chromium-phase28-trace.zip`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/traces/firefox-phase28-trace.zip`
- `docs/ops/artifacts/phase-28-1-chart-symbol-latency/traces/webkit-phase28-trace.zip`

Probe setup:

| Field | Result |
| --- | --- |
| Authenticated session | true |
| Chart workspace saved | true |
| Workspace API status | 200 |
| Temporary probe user cleanup requested | true |
| Browser coverage | Chromium, Firefox, WebKit |
| Overall status | `not_ready` |

The probe still reports `premium: false` for the temporary identity even though authenticated session creation and chart workspace persistence succeeded. That entitlement mismatch is not the measured latency bottleneck, but it should be investigated separately before relying on probe identity for premium-only workflow proof.

## Timing Results

### Chromium

| Workflow | Observed | Target | Result |
| --- | ---: | ---: | --- |
| `/symbol/AMD` interactive | 3942.604 ms | <2500 ms | Fail |
| Chart workspace restore | 377.4 ms | <250 ms | Fail |
| Fullscreen chart open | 128.3 ms | <150 ms | Pass |
| Chart toolbar interaction | 61.3 ms | <60 ms | Fail |
| Symbol switch AMD -> NVDA | 3279.6 ms | <150 ms | Fail |
| Symbol search open | 7.9 ms | <100 ms | Pass |

### Firefox

| Workflow | Observed | Target | Result |
| --- | ---: | ---: | --- |
| `/symbol/AMD` interactive | 8442.960 ms | <2500 ms | Fail |
| Chart workspace restore | 567 ms | <250 ms | Fail |
| Fullscreen chart open | 68 ms | <150 ms | Pass |
| Chart toolbar interaction | 5 ms | <60 ms | Pass |
| Symbol switch AMD -> NVDA | 3042 ms | <150 ms | Fail |
| Symbol search open | 614 ms | <100 ms | Fail |

### WebKit

| Workflow | Observed | Target | Result |
| --- | ---: | ---: | --- |
| `/symbol/AMD` interactive | 10530.902 ms | <2500 ms | Fail |
| Chart workspace restore | 4723 ms | <250 ms | Fail |
| Fullscreen chart open | 956 ms | <150 ms | Fail |
| Chart toolbar interaction | 66 ms | <60 ms | Fail |
| Symbol switch AMD -> NVDA | 3637 ms | <150 ms | Fail |
| Symbol search open | 542 ms | <100 ms | Fail |

## Improvement Against Phase 27.5 Baseline

Chromium comparison:

| Workflow | Phase 27.5 | Phase 28.1 | Target | Movement |
| --- | ---: | ---: | ---: | --- |
| `/symbol/AMD` interactive | 3195.214 ms | 3942.604 ms | <2500 ms | Regressed in focused run |
| Chart workspace restore | 2950.487 ms | 377.4 ms | <250 ms | Large improvement, still over target |
| Fullscreen chart open | 123.8 ms | 128.3 ms | <150 ms | Still passing |
| Chart toolbar interaction | 79.2 ms | 61.3 ms | <60 ms | Improved, still 1.3 ms over target |
| Symbol switch | 3663.420 ms | 3279.6 ms | <150 ms | Improved, still severe |
| Symbol search open | 233.284 ms | 7.9 ms | <100 ms | Pass |

## Remaining Blockers

Full Phase 28.1 accomplishment is blocked by:

- Symbol switching is still a multi-second route transition instead of a sub-150 ms symbol model replacement.
- `/symbol/AMD` interactive remains above target in all tested browsers.
- Chart workspace shell restore improved substantially in Chromium but is still above target and is especially slow in WebKit.
- WebKit has major chart restore, fullscreen open, symbol switch, and symbol search latency failures.
- Firefox symbol search open still exceeds the target despite the Chromium fix.
- Chart toolbar interaction is nearly at target in Chromium but still misses by a small margin.
- Temporary authenticated probe identity reports `premium: false`; entitlement setup needs a separate fix for premium-only proof reliability.

## Next Remediation Direction

The next latency closure should focus on:

- Replacing symbol page route transition with in-place symbol model replacement where the user is already in a chart/symbol workflow.
- Preserving the chart shell across symbol changes and swapping only the visible series/model.
- Splitting `/symbol/[symbol]` route hydration so first interactive is not blocked by full intelligence, history, replay, and performance payloads.
- Creating a WebKit-specific chart restore profile from the captured trace.
- Moving symbol search index hydration earlier for Firefox/WebKit or reducing the overlay's first-open dependency tree in those engines.
- Tightening chart toolbar state isolation so compare-mode toggles do not touch parent chart state.

## Verdict

Strong partial only. The production deployment, focused probe, screenshots, traces, and material Chromium wins are complete, and Chromium now passes fullscreen chart open and symbol search open. Certification is not complete because chart restore, symbol switch, `/symbol/AMD` interactive, and WebKit/Firefox timings still miss the required production targets.
