# Phase 35.0C.2 Chart Workspace Restore + Symbol Switch Latency Closure

Generated: 2026-06-10

## Objective

Close the authenticated chart workflow blockers from Phase 35.0C:

- Chart workspace restore measured at 2535 ms, target under 250 ms.
- Route-level symbol switch measured at 1147 ms, target under 100 ms.
- Prove Chromium, Firefox, and WebKit authenticated workflows without mixing public unauthenticated smoke.

## Implementation Summary

Runtime changes:

- Added browser timing marks for chart workspace restore start, localStorage read, shell readiness, deferred hydration, and account workspace fetch/merge.
- Added chart render pipeline marks for layout measurement, lightweight chart library initialization, series creation, series data application, and fit-content layout.
- Added symbol hot-packet cache/fetch timing marks.
- Added symbol switch source and navigation-entry timing marks.
- Added chart root data attributes for active symbol, packet source, workspace loaded state, account workspace state, and candle count.

Probe changes:

- Added Phase 35.0C.2 probe mode to `frontend/scripts/phase28-chart-symbol-latency-probe.mjs`.
- Added dedicated npm command: `npm --prefix frontend run probe:phase35:chart-workflow-latency`.
- Enforced symbol switch budget at 100 ms for this phase.
- Verified symbol switch uses in-place chart replacement by checking navigation entry count before and after switch.
- Changed `/symbol/AMD` interactive measurement to use browser in-page chart shell/render marks with separate Playwright locator verification.
- Captured screenshots and Playwright traces for Chromium, Firefox, and WebKit.

## Local Validation

Passed locally before production deploy:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 572 passed, 0 failed
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

Additional probe-only edits passed:

- `node --check frontend/scripts/phase28-chart-symbol-latency-probe.mjs`
- `git diff --check`

## Production Deployment

Production host:

- `sre@100.68.155.121`
- `/opt/apps/market-alpha-scanner/app`

Deployment:

- Pulled `main` fast-forward to commit `b9c57673`.
- Rebuilt and restarted:
  - `market-alpha-frontend`
  - `market-alpha-frontend-hot-api`
- Pulled probe-only corrections through commit `5f0931b7`; no rebuild required for probe-only script changes.

Production smoke:

- `/api/health`: ok
- `/api/health/deep`: app and DB ok, scanner ok, backup warning from R2 offsite timeout unrelated to this deploy
- Route smoke:
  - `/terminal` 200
  - `/discover` 200
  - `/scanner` 200
  - `/paper` 200
  - `/strategy-labs` 200
  - `/market-memory` 200
  - `/symbol/AMD` 200
  - `/alerts` 200
  - `/feed` 200
  - `/macro` 200

## Evidence Artifacts

Primary final full-matrix artifact:

- `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/phase35-0c-2-final-chart-symbol-latency.json`
- Screenshots:
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/screenshots/chromium/symbol-workflow.png`
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/screenshots/firefox/symbol-workflow.png`
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/screenshots/webkit/symbol-workflow.png`
- Traces:
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/traces/chromium-phase35-0c-2-final-trace.zip`
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/traces/firefox-phase35-0c-2-final-trace.zip`
  - `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/final-full-matrix/traces/webkit-phase35-0c-2-final-trace.zip`

Supporting rerun artifact:

- `docs/ops/artifacts/phase-35-0c-2-chart-workflow-latency/rerun-firefox-webkit/phase35-0c-2-rerun-chart-symbol-latency.json`

## Final Full-Matrix Results

| Browser | Overall | `/symbol/AMD` interactive | Chart restore | Fullscreen | Toolbar | Symbol switch | Search open |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | ready | 1780.4 ms | 30.3 ms | 2 ms | 0.1 ms | 7.6 ms | 2.5 ms |
| Firefox | not_ready | 4495 ms | 13 ms | 7 ms | 0 ms | 15 ms | 7 ms |
| WebKit | not_ready | 1463 ms | 87 ms | 5 ms | 0 ms | 149 ms | 2 ms |

Budgets:

- `/symbol/AMD` interactive: under 2500 ms
- Chart workspace restore: under 250 ms
- Fullscreen chart open: under 150 ms
- Toolbar interaction: under 60 ms
- Symbol switch: under 100 ms
- Symbol search open: under 100 ms

## Root Cause Findings

### Chart Workspace Restore

Status: closed for the measured chart restore metric.

Evidence:

- Chromium: 30.3 ms
- Firefox: 13 ms
- WebKit: 87 ms

Breakdown:

- localStorage read: 0 to 0.1 ms
- workspace shell readiness delta: 0 to 0.2 ms
- account workspace API fetch is deferred after shell readiness
- account fetch observed at 233 to 309 ms, but does not block the chart restore metric
- chart render pipeline remains small in final full matrix:
  - Chromium chart render: 19.6 ms
  - Firefox chart render: 6 ms
  - WebKit chart render: 24 ms

Conclusion:

The earlier 2535 ms chart restore blocker was not measuring real chart workspace restore. It was a late route/probe marker style measurement. The actual chart workspace shell restore is under 250 ms in all final-matrix browsers.

### Symbol Switch

Status: partially closed, not certified.

Evidence:

- Symbol switch does not create a new document navigation.
- Navigation entry count remains `1` before and after switch.
- URL changes from `/symbol/AMD` to `/symbol/NVDA`.
- Chart root changes from `AMD` to `NVDA`.
- Packet source after switch is `active-hot-packet`.

Final full-matrix timings:

- Chromium: 7.6 ms
- Firefox: 15 ms
- WebKit: 149 ms

Supporting rerun:

- WebKit symbol switch passed at 65 ms in the focused Firefox/WebKit rerun.

Conclusion:

In-place symbol replacement is implemented and verified, but WebKit is not reliably below the 100 ms target. The final full matrix failed at 149 ms.

### `/symbol/AMD` Route Interactive

Status: not certified.

Final full-matrix:

- Chromium: 1780.4 ms, pass
- Firefox: 4495 ms, fail
- WebKit: 1463 ms, pass

Supporting focused rerun:

- Firefox: 1877.551 ms, pass
- WebKit: 2990.655 ms, fail

Root-cause evidence:

- Firefox final full-matrix TTFB was 143 ms and chart render duration was 6 ms, but shell mark appeared at 4495 ms.
- WebKit final full-matrix route passed, but prior focused rerun showed a 2990.655 ms shell mark.
- These failures are not explained by chart library initialization, series creation, localStorage reads, or account workspace API fetch.

Likely remaining cause:

- Browser-specific shell scheduling/hydration variability under the authenticated Playwright matrix.
- Firefox and WebKit are not yet stable enough for certification even though individual chart interaction metrics pass in many runs.

## Remaining Blockers

Critical:

1. Firefox `/symbol/AMD` interactive is unstable and failed the final full matrix at 4495 ms.
2. WebKit in-place symbol switch is unstable and failed the final full matrix at 149 ms.

High:

1. WebKit route timing has shown run-to-run variance: 1463 ms pass in final full matrix, 2990.655 ms fail in focused rerun.
2. Firefox route timing has shown run-to-run variance: 1877.551 ms pass in focused rerun, 4495 ms fail in final full matrix.

## Final Certification

`CHART WORKFLOW PERFORMANCE NOT ACCOMPLISHED`

Reason:

The chart restore target is accomplished, and in-place symbol switching is implemented and verified. However, the final authenticated Chromium/Firefox/WebKit matrix remains `not_ready` because Firefox route interactive and WebKit symbol switch missed mandatory targets.

