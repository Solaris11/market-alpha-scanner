# Phase 21.1 - Authenticated Performance + BrowserStack Certification

Final status: pending production certification

Production base URL: `https://tradeveto.com`

## Scope

Phase 21.1 targets the hard blockers reopened by Phase 20.10:

- BrowserStack Automate real-device coverage for iPhone Safari and Android Chrome.
- Authenticated `/api/discovery` p95 under `300 ms`, p99 under `600 ms`.
- Authenticated `/api/live-intelligence` p95 under `400 ms`, p99 under `800 ms`.
- Production mobile QA across required flagship routes.
- Production evidence without inflated claims.

## Local Implementation

- Added BrowserStack Playwright SDK wiring with repo-root `browserstack.yml`.
- Added real-device mobile Playwright coverage for:
  - `/terminal`
  - `/discover`
  - `/scanner`
  - `/paper`
  - `/strategy-labs`
  - `/market-memory`
  - `/feed`
  - `/macro`
  - `/symbol/AMD`
  - `/alerts`
  - `/history`
  - `/performance`
- Added BrowserStack npm scripts:
  - `npm --prefix frontend run test:browserstack`
  - `npm --prefix frontend run test:browserstack:mobile`
  - `npm --prefix frontend run test:phase21:mobile-real-device`
- Added authenticated performance probe script:
  - `npm --prefix frontend run probe:phase21:authenticated`
- Added stale-safe discovery hot packets with background refresh.
- Added bounded live-intelligence cache, timeout protection, and degraded warmup fallback.
- Added hot endpoint p50/p95/p99/cache-hit telemetry to admin monitoring.
- Added live-intelligence response timing headers and performance snapshot payload.
- Extended scale probe output with failure counts and timeout rates.

## Local Validation

Completed before production deploy:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | pass |
| `npm --prefix frontend test -- --runInBand` | pass, 473 tests |
| `npm --prefix frontend run build` | pass |
| `npm --prefix frontend audit --omit=dev` | pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | pass, 0 errors / 0 warnings |
| `git diff --check` | pass |
| `npx playwright test --config=playwright.phase21.config.ts --list` | pass, 12 route tests listed |

## BrowserStack Real-Device Matrix

Configured platforms:

| Device | Browser | Real device | Status |
| --- | --- | --- | --- |
| iPhone 15 Pro Max | Safari | yes | pending production run |
| Samsung Galaxy S23 Ultra | Chrome | yes | pending production run |

## Production Deploy Proof

Pending.

## Production Smoke Proof

Pending.

Required smoke:

- `curl -fsS https://tradeveto.com/api/health`
- `curl -fsS https://tradeveto.com/api/health/deep`
- `/terminal`
- `/discover`
- `/scanner`
- `/paper`
- `/strategy-labs`
- `/market-memory`

## BrowserStack Evidence

Pending production run.

| Evidence | Value |
| --- | --- |
| Build URL | pending |
| iPhone Safari session URL | pending |
| Android Chrome session URL | pending |
| Screenshot artifacts | pending |
| Video links | pending |
| Console logs | pending |
| Network logs | pending |

## Authenticated Performance Evidence

Pending production probe.

Target budgets:

| Endpoint | p95 target | p99 target |
| --- | ---: | ---: |
| `/api/discovery` | `<300 ms` | `<600 ms` |
| `/api/live-intelligence` | `<400 ms` | `<800 ms` |

Production probe must use authenticated coverage with concurrency at least `25`.

## Remaining Blockers

Pending production evidence.
