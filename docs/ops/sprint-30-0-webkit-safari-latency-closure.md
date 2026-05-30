# Sprint 30.0 - WebKit / Safari Latency Closure

## Verdict

**ACCOMPLISHED**

Sprint 30.0 closes the remaining Phase 29.3 WebKit/Safari latency blockers in production. The authenticated production browser matrix is ready across Chromium, Firefox, and WebKit.

## Production Deployment

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Runtime optimization commit deployed and rebuilt: `82afad6d`
- Probe/reporting fix pulled on production: `d59b6efa`
- Rebuild command used for runtime change: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Healthy containers after rebuild: `market-alpha-frontend`, `market-alpha-frontend-hot-api`

## Root Cause

The prior failing WebKit run showed low TTFB but late first shell visibility:

- WebKit TTFB: about `73 ms`
- HTML streaming end: about `2858 ms`
- DOMContentLoaded: about `3001 ms`
- first visible shell: about `3493 ms`
- chart render start: about `3962 ms`

The extra delay was not DNS, TLS, or request startup. It was the large cold `/symbol/[symbol]` server response and deep symbol route work delaying WebKit paint until the streamed payload was effectively complete.

## Implemented Fixes

- Added a real data-backed `/symbol/[symbol]` route-ready strip before the heavy workspace.
- Replaced the cold symbol route workspace with a fast chart-first workspace path.
- Excluded non-critical deep panels from the initial route render:
  - market memory
  - replay/history panels
  - performance analysis
  - provider/news intelligence
  - deep AI analysis
  - personalization-heavy panels
- Kept verified row data, price history, chart shell, command search, and chart interactions available on the cold route.
- Fixed the timing probe so missing timing phases are reported as `null`, not `0 ms`.
- Added a measured shell-interactive DOM readiness check instead of guessing.

## Production Smoke

Run after production rebuild:

| Route | Result |
| --- | ---: |
| `/api/health` | pass |
| `/api/health/deep` | pass |
| `/symbol/AMD` | 200 |
| `/symbol/NVDA` | 200 |
| `/terminal` | 200 |
| `/scanner` | 200 |
| `/history` | 200 |
| `/performance` | 200 |

## Browser Matrix

Production timing artifact:

`docs/ops/artifacts/sprint-30-0-webkit-safari-latency/sprint30-0-chart-symbol-latency.json`

| Browser | Overall | `/symbol/AMD` Interactive | Chart Restore | Fullscreen Chart | Toolbar | Symbol Switch | Search Open |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | ready | `499.417 ms` | `32.1 ms` | `1.9 ms` | `0 ms` | `11.9 ms` | `2.5 ms` |
| Firefox | ready | `558.793 ms` | `39 ms` | `5 ms` | `0 ms` | `9 ms` | `41 ms` |
| WebKit | ready | `739.039 ms` | `87 ms` | `3 ms` | `0 ms` | `65 ms` | `2 ms` |

## Timing Breakdown

| Browser | `page.goto` Commit | TTFB | HTML Start | HTML End | DOMContentLoaded | First Shell Visible | Shell Interactive | Chart Start | Chart Complete | Symbol Switch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | `125.434 ms` | `57.5 ms` | `106 ms` | `181.4 ms` | `287.2 ms` | `499.417 ms` | `595.246 ms` | `780.2 ms` | `791.4 ms` | `11.9 ms` |
| Firefox | `267.165 ms` | `78 ms` | `116 ms` | `116 ms` | `612 ms` | `558.793 ms` | `624.137 ms` | `580 ms` | `591 ms` | `9 ms` |
| WebKit | `256.423 ms` | `91 ms` | `-95 ms` | `10 ms` | `162 ms` | `739.039 ms` | `810.204 ms` | `1422 ms` | `1447 ms` | `65 ms` |

Note: WebKit reports some navigation timing offsets as negative relative to the page time origin. The pass/fail gates use measured route and browser workflow timings, not the negative raw offsets.

Deep hydration start/complete are `null` in the final report because Sprint 30.0 removes those non-critical panels from the cold symbol route. They are no longer hidden blocking work during initial `/symbol/AMD` interactivity.

## Production Artifacts

- Timing JSON: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/sprint30-0-chart-symbol-latency.json`
- Chromium screenshot: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/screenshots/chromium/symbol-workflow.png`
- Firefox screenshot: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/screenshots/firefox/symbol-workflow.png`
- WebKit screenshot: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/screenshots/webkit/symbol-workflow.png`
- Chromium trace: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/traces/chromium-sprint30-0-trace.zip`
- Firefox trace: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/traces/firefox-sprint30-0-trace.zip`
- WebKit trace: `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/sprint-30-0-webkit-safari-latency/traces/webkit-sprint30-0-trace.zip`

## Local Validation

- `npm --prefix frontend run lint`: passed
- `npm --prefix frontend test -- --runInBand`: passed, 536/536
- `npm --prefix frontend run build`: passed
- `npm --prefix frontend audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed

## Certification Status

All Sprint 30.0 browser latency gates passed in production:

- `/symbol/AMD` interactive `< 2500 ms`
- chart restore `< 250 ms`
- fullscreen chart `< 150 ms`
- toolbar interaction `< 60 ms`
- symbol switch `< 150 ms`
- search open `< 100 ms`
- Chromium, Firefox, and WebKit all ready
