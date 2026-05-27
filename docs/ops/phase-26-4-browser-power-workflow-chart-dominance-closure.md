# Phase 26.4 - Browser Power Workflow + Chart Dominance Closure

Date: 2026-05-27

## Verdict

TRADEVETO BROWSER POWER WORKFLOW + CHART DOMINANCE CLOSURE STRONG PARTIAL ACCOMPLISHED

The Phase 26.4 production browser proof is strong partial, not full accomplishment. Real browser timing instrumentation is now deployed and the production probe captured chart/scanner screenshots plus browser-performance timing JSON. Scanner interaction targets passed in production. Full certification is blocked by missing 500+ production browser rows and chart workflow latency misses.

## Critical Issue

Phase 25 chart/scanner deterministic probes were strong, but browser-level workflow proof still missed important targets:

- scanner ultra-dense interaction exceeded 100 ms
- scanner sort/search exceeded 100 ms
- compare open exceeded 150 ms
- chart fullscreen open and chart toolbar interactions exceeded target
- rapid symbol switching exceeded 100 ms
- production browser scanner exposed 111 rows, so 500+ browser-row proof was not established

## Implementation

- Added in-browser workflow timing instrumentation for scanner and chart interactions via `window.__tradevetoBrowserWorkflowMetrics`.
- Scanner instrumentation now records browser click/input-to-next-frame timing for:
  - ultra-dense mode
  - filtering
  - sorting
  - compare open
  - row expansion
  - fullscreen scanner toggle
- Chart instrumentation now records browser click-to-next-frame timing for:
  - fullscreen chart open
  - fullscreen toolbar mode/layout actions
  - drawing toolbar operations
  - drawing object commits
- Extended the existing chart/scanner browser probe with Phase 26.4 artifact paths and browser-performance timing source support.
- Added production browser screenshots for:
  - ultra-dense scanner
  - compare workflow
  - fullscreen scanner
  - symbol chart
  - fullscreen chart
  - symbol switch
- Added `npm --prefix frontend run probe:phase26:browser-power-workflow`.
- Added stable workflow selectors for scanner sort, chart fullscreen open, chart template save, and chart alert save so browser probes use product controls instead of brittle text/ancestor matching.
- Kept unsupported claims bounded: no TradingView parity claim, no fake drawing proximity alert engine, and no fake indicator alert evaluation.

## Targets

| Workflow | Target |
| --- | ---: |
| Scanner interaction | < 100 ms |
| Compare open | < 150 ms |
| Chart interaction | < 60 ms |
| Fullscreen chart open | < 150 ms |
| Workspace restore | < 250 ms |
| Rapid symbol switch | < 100 ms |

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
| `node --check frontend/scripts/phase25-chart-scanner-browser-timing-probe.mjs` | Pass |

## Production Deploy Proof

- Runtime instrumentation commit deployed: `c59020a9` (`Stabilize phase 26 browser workflow probe`).
- Probe selector-only commit pulled on production: `0c63eb37` (`Tighten chart workspace probe selector`).
- Production pull path: `/opt/apps/market-alpha-scanner/app`.
- Rebuild command used for runtime changes:
  - `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Container health after rebuild:
  - `market-alpha-frontend`: healthy
  - `market-alpha-frontend-hot-api`: healthy
- Production health smoke:
  - `https://tradeveto.com/api/health`: `ok`
  - `https://tradeveto.com/api/health/deep`: response returned successfully
- Route smoke passed with HTTP 200:
  - `/terminal`
  - `/discover`
  - `/scanner`
  - `/paper`
  - `/strategy-labs`
  - `/market-memory`
  - `/symbol/AMD`
  - `/alerts`
  - `/feed`
  - `/macro`
- Production host Chromium dependencies were installed with `sudo npx playwright install-deps chromium` before the browser probe. No BrowserStack, deterministic-only, or synthetic timing proof was used for the final production browser timing artifact.

## Production Browser Probe

Final artifacts:

- `docs/ops/artifacts/phase-26-4-browser-workflows/chart-scanner-browser-timing.json`
- `docs/ops/artifacts/phase-26-4-browser-workflows/large-universe-proof.json`
- `docs/ops/artifacts/phase-26-4-browser-workflows/screenshots/`

The final production probe ran against `https://tradeveto.com` with an authenticated temporary premium probe user created in production and removed after the run. Secrets and session tokens were not printed or committed.

### Scanner Results

| Workflow | Target | Production Result | Source | Result |
| --- | ---: | ---: | --- | --- |
| Ultra-dense mode | < 100 ms | 74.6 ms | browser-performance | Pass |
| Large-watchlist filter | < 150 ms | 51.7 ms | browser-performance | Pass |
| Sort/search | < 100 ms | 75.5 ms | browser-performance | Pass |
| Compare open | < 150 ms | 76.1 ms | browser-performance | Pass |
| Saved scan restore | < 250 ms | 57.375 ms | Playwright/browser operation | Pass |
| Row expansion | < 100 ms | 60.363 ms | Playwright/browser operation | Pass |
| Fullscreen scanner | < 100 ms | 90.3 ms | browser-performance | Pass |

Scanner checks:

- `scanner-row-alert`: pass
- `scanner-keyboard-shortcuts`: pass
- horizontal overflow: 0 px
- ultra-dense screenshot captured
- compare screenshot captured
- fullscreen scanner screenshot captured

Scanner blocker:

- Production browser scanner exposed only 111 rows, below the required 500+ symbol proof.
- Virtualization was not active because the production browser table only had 111 rows; this is not a 500+ large-universe proof.

### Chart Results

| Workflow | Target | Production Result | Source | Result |
| --- | ---: | ---: | --- | --- |
| Workspace restore | < 250 ms | 9048.269 ms | page/browser operation | Fail |
| Fullscreen chart open | < 150 ms | 257.6 ms | browser-performance | Fail |
| Chart compare interaction | < 60 ms | 26.1 ms | browser-performance | Pass |
| Drawing operation | < 60 ms | 51.6 ms | browser-performance | Pass |
| Toolbar collapse/restore | < 60 ms | 77.9 ms | browser-performance | Fail |
| Rapid symbol switch | < 100 ms | 3210.287 ms | page/browser operation | Fail |

Chart checks:

- `chart-indicator-template`: pass
- `chart-alert-save`: pass
- `fullscreen-toolbar-collapse`: pass
- symbol chart screenshot captured
- fullscreen chart screenshot captured
- NVDA symbol-switch screenshot captured

Memory:

- JS heap before: 0.489 MB
- JS heap after: 120.097 MB
- Delta: 119.608 MB
- No runaway browser heap blocker was triggered by the probe threshold.

## Remaining Blockers

- 500+ production browser scanner proof is still missing; final proof saw 111 production rows.
- Production large-universe browser virtualization proof is not established because row count did not reach the virtualization threshold.
- Chart workspace restore is far over target at 9048.269 ms.
- Fullscreen chart open is over target at 257.6 ms.
- Chart toolbar collapse/restore is over target at 77.9 ms.
- Rapid symbol switch is far over target at 3210.287 ms.
- The result cannot be marked accomplished without meeting the browser timing budgets and proving 500+ real production browser rows.
