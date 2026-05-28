# Phase 29.3 — Chart/Symbol Instant Workflow Rewrite

## Verdict

**TRADEVETO CHART/SYMBOL INSTANT WORKFLOW REWRITE NOT ACCOMPLISHED**

Phase 29.3 substantially improved the chart/symbol workflow path, but the strict cross-browser production gate is still red because WebKit missed the `/symbol/AMD` route interactive target and narrowly missed one symbol-switch timing sample.

## Production Deployment

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Final deployed commit: `992ad30a605c0eb4ad2dc2857964f27b28e1de4f`
- Rebuild command used: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Containers checked healthy: `market-alpha-frontend`, `market-alpha-frontend-hot-api`

## Implementation Summary

- Added streamed `/symbol/[symbol]` fast shell so a real data-backed chart/symbol surface appears before deep replay, performance, market-memory, and provider panels complete.
- Deferred deep symbol server hydration by one tick to let the fast shell flush first.
- Added shell readiness metric emission for `chart:workspace-restore` from the real fast shell.
- Added server-prefetched adjacent chart packets to support in-place symbol switching without full route navigation.
- Seeded the chart hot-packet cache from prefetched packets.
- Changed chart symbol navigation to `flushSync` cached packet swaps and record symbol-switch metrics immediately after the in-place commit.
- Replaced the first fullscreen chart shell with a lightweight fixed dialog instead of the heavier governed/motion overlay path; the full workstation still hydrates after the shell.

## Changed Runtime Files

- `frontend/src/app/symbol/[symbol]/page.tsx`
- `frontend/src/components/terminal/SymbolChart.tsx`
- `frontend/src/components/terminal/SymbolTerminalWorkspace.tsx`

## Local Validation

- `npm --prefix frontend run lint`: passed
- `npm --prefix frontend test -- --runInBand`: passed, 536/536
- `npm --prefix frontend run build`: passed
- `npm --prefix frontend audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed

## Production Smoke

Artifact: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/production-smoke.txt`

| Route | Status |
| --- | ---: |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/symbol/AMD` | 200 |
| `/symbol/NVDA` | 200 |
| `/terminal` | 200 |
| `/scanner` | 200 |
| `/history` | 200 |
| `/performance` | 200 |

## Browser Timing Proof

Artifact: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/phase29-3-chart-symbol-latency.json`

| Browser | Overall | `/symbol/AMD` Interactive | Chart Restore | Fullscreen Open | Toolbar | Symbol Switch | Search Open |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | ready | 540.514 ms | 0 ms | 3.9 ms | 0 ms | 7.5 ms | 2.8 ms |
| Firefox | ready | 539.513 ms | 0 ms | 6 ms | 0 ms | 13 ms | 54 ms |
| WebKit | not_ready | 3529.746 ms | 0 ms | 4 ms | 0 ms | 151 ms | 1 ms |

Budgets:

| Metric | Target |
| --- | ---: |
| `/symbol/AMD` interactive | `< 2500 ms` |
| Chart restore | `< 250 ms` |
| Fullscreen chart open | `< 150 ms` |
| Toolbar interaction | `< 60 ms` |
| Symbol switch | `< 150 ms` |
| Symbol search open | `< 100 ms` |

## Production Artifacts

- Timing JSON: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/phase29-3-chart-symbol-latency.json`
- Smoke proof: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/production-smoke.txt`
- Chromium screenshot: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/screenshots/chromium/symbol-workflow.png`
- Firefox screenshot: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/screenshots/firefox/symbol-workflow.png`
- WebKit screenshot: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/screenshots/webkit/symbol-workflow.png`
- Chromium trace: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/traces/chromium-phase29-3-trace.zip`
- Firefox trace: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/traces/firefox-phase29-3-trace.zip`
- WebKit trace: `docs/ops/artifacts/phase-29-3-chart-symbol-instant-workflow/traces/webkit-phase29-3-trace.zip`

## No-Fabrication Boundary

- The fast symbol shell uses the same verified symbol row and real stored price history used by the full workstation.
- No fake candles, fake alerts, fake provider events, or fake intelligence fields were introduced.
- Deferred panels are explicitly described as hydrating after the shell; placeholders are not presented as completed intelligence.
- The final verdict is not inflated because the WebKit hard gate remains red.

## Remaining Blockers

1. WebKit `/symbol/AMD` direct route interactive remains above budget:
   - Measured: `3529.746 ms`
   - Target: `< 2500 ms`

2. WebKit symbol switch narrowly missed in the final full matrix:
   - Measured: `151 ms`
   - Target: `< 150 ms`

3. Follow-up work should isolate WebKit cold route behavior with route timing breakdowns:
   - `page.goto` commit time
   - body visibility time
   - first streamed shell visibility time
   - full server response completion time
   - WebKit connection/browser-process warmup cost

