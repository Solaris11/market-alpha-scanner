# Phase 25.3 - Chart + Scanner Power Workflow Proof

## Verdict

TRADEVETO CHART + SCANNER POWER WORKFLOW PROOF NOT ACCOMPLISHED

Phase 25.3 produced useful proof, but the production browser evidence does not certify the requested workflow targets.

## Scope

This phase added a production browser timing probe for chart and scanner workflows and reused the deterministic 500+ symbol workflow probe. Claims remain bounded:

- No full TradingView parity claim.
- No fake indicator alert or fake drawing proximity alert claim.
- No physical-device gesture latency claim.

## Implemented Changes

- Added `frontend/scripts/phase25-chart-scanner-browser-timing-probe.mjs`.
- Added `npm --prefix frontend run probe:phase25:chart-scanner-browser-timing`.
- Updated the deterministic chart/scanner probe wording so Browser DOM timing is covered by the new companion probe.
- The browser probe captures:
  - authenticated scanner UI timing
  - saved scan restore timing
  - compare open timing
  - scanner keyboard shortcut smoke
  - chart workspace restore timing
  - fullscreen chart open timing
  - chart toolbar timing
  - screenshots for scanner, compare, symbol, fullscreen chart, and symbol switch

## Local Validation

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 513 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors and 0 warnings.
- `node --check frontend/scripts/phase25-chart-scanner-browser-timing-probe.mjs` - passed.
- `node --check frontend/scripts/phase25-chart-scanner-power-workflow-probe.mjs` - passed.
- `git diff --check` - passed.

## Production Deployment

- Production pulled `origin/main` to `c3da99a`.
- Rebuilt and redeployed `market-alpha-frontend` with `docker compose --env-file .env up -d --build market-alpha-frontend`.
- `market-alpha-frontend` reached `healthy`.

## Production Smoke

Production smoke passed:

- `https://tradeveto.com/api/health` - 200.
- `https://tradeveto.com/api/health/deep` - 200.
- `https://tradeveto.com/discover` - 200.
- `https://tradeveto.com/scanner` - 200.
- `https://tradeveto.com/symbol/AMD` - 200.
- `https://tradeveto.com/terminal` - 200.
- `https://tradeveto.com/market-memory` - 200.

## Artifacts

- Deterministic production JSON: `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-deterministic.json`
- Browser timing JSON: `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/chart-scanner-browser-timing.json`
- Browser screenshots:
  - `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/screenshots/discover-ultra-dense.png`
  - `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/screenshots/discover-compare.png`
  - `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/screenshots/symbol-amd.png`
  - `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/screenshots/symbol-amd-fullscreen.png`
  - `docs/ops/artifacts/phase-25-3/chart-scanner-power/production-browser-timing/screenshots/symbol-nvda.png`

## Deterministic Production Probe

Status: `ready`.

| Workflow | p95 | p99 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| Scanner interaction | 0.360 ms | 1.449 ms | 100 ms | Pass |
| Large-watchlist filter | 0.195 ms | 0.254 ms | 150 ms | Pass |
| Compare open | 0.025 ms | 0.108 ms | 150 ms | Pass |
| Chart interaction | 0.007 ms | 0.083 ms | 60 ms | Pass |
| Fullscreen chart open | 0.003 ms | 0.018 ms | 150 ms | Pass |
| Chart workspace restore | 0.050 ms | 0.240 ms | 250 ms | Pass |
| Rapid symbol switch | 0.172 ms | 4.835 ms | 100 ms | Pass |

Large-universe deterministic proof:

- Synthetic scanner universe: 520 symbols.
- Synthetic large watchlist: 500 symbols.
- Virtual window: 74 rendered rows from 520 total rows.
- Memory delta: 14.8 MB RSS.

## Production Browser Timing Probe

Status: `not_ready`.

| Workflow | Latency | Budget | Result |
| --- | ---: | ---: | --- |
| Scanner ultra-dense interaction | 238.383 ms | 100 ms | Fail |
| Large-watchlist filter | 66.339 ms | 150 ms | Pass |
| Scanner sort/search | 291.544 ms | 100 ms | Fail |
| Compare open | 235.348 ms | 150 ms | Fail |
| Saved scan restore | 56.329 ms | 250 ms | Pass |
| Chart workspace restore | 8838.458 ms | 250 ms | Fail |
| Fullscreen chart open | 30006.916 ms | 150 ms | Fail |
| Chart interaction | 97.787 ms | 60 ms | Fail |
| Rapid symbol switch | 2800.636 ms | 100 ms | Fail |

Browser UI checks:

| Check | Result |
| --- | --- |
| Scanner keyboard shortcuts | Pass |
| Scanner row alert creation | Fail |
| Chart indicator template operation | Fail |
| Chart alert save | Fail |
| Fullscreen toolbar collapse | Pass |

Browser memory:

- JS heap before: 0.490 MB.
- JS heap after: 109.011 MB.
- Delta: 108.521 MB.
- No runaway threshold breach was recorded, but the probe did not run a long-duration memory ceiling test.

## Exact Blockers

- Production browser scanner exposed only 111 rows, so 500+ browser-row proof was not established.
- Scanner virtualization did not activate in the browser proof because production exposed 111 rows; `data-scanner-virtualized=false`.
- Scanner ultra-dense interaction missed the 100 ms budget.
- Scanner sort/search missed the 100 ms budget.
- Compare open missed the 150 ms budget.
- Scanner row alert creation was not proven because the row action detached during browser interaction.
- Chart workspace restore timing included a slow route/workspace load and missed the 250 ms budget.
- Fullscreen chart open failed via Playwright because the expand control was visible but treated as outside the viewport during click retries.
- Chart interaction missed the 60 ms budget.
- Rapid symbol switch missed the 100 ms budget.
- Chart indicator template save and chart alert save were not proven through browser clicks.

## What Is Proven

- The deterministic 500+ symbol scanner and 500-symbol watchlist workflow implementation is bounded and fast.
- Production deploy and smoke are healthy.
- Authenticated browser access can create saved scans and chart workspace fixtures.
- Browser screenshots were captured for scanner, compare, symbol, fullscreen chart, and symbol switching.
- Browser large-watchlist filter and saved scan restore were under target.
- Scanner keyboard shortcut smoke passed.
- Fullscreen toolbar collapse smoke passed.

## What Is Not Proven

- Production browser 500+ symbol scanner workflow.
- Production browser virtualization under 500+ rows.
- Scanner interaction under 100 ms in browser.
- Compare open under 150 ms in browser.
- Chart interaction under 60 ms in browser.
- Fullscreen chart open under 150 ms in browser.
- Workspace restore under 250 ms in browser.
- Row alert creation by browser UI.
- Chart alert/template operations by browser UI.
- Physical-device gesture latency.

## Final Certification

The deterministic workflow proof is strong, but the production browser proof misses key budgets and does not establish 500+ row production scanner behavior. Certification remains blocked.
