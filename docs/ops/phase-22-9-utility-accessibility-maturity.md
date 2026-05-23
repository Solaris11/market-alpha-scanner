# Phase 22.9 - Low-Score Utility Surfaces + Accessibility Maturity

Date: 2026-05-23

Runtime commit: `84d64277`

Verdict: `TRADEVETO LOW-SCORE UTILITY + ACCESSIBILITY MATURITY ACCOMPLISHED`

## Scope

Phase 22.9 targeted the utility surfaces that were below 90 in the Phase 21.9 audit:

- `/account`
- `/settings`
- `/support`
- `/alerts`
- `/history`
- `/performance`

The implementation added a shared utility maturity contract, visible maturity panels, actual settings controls, route headings for accessibility, and an Axe-backed cross-browser smoke script.

## Implemented Surface Fixes

| Surface | Fixes |
| --- | --- |
| Account | Added trust center, subscription clarity, active session/device management readout from `user_sessions`, data/privacy visibility, and maturity checklist. |
| Settings | Added account-backed notification preference controls using `/api/user/notification-preferences`; added local chart/scanner/mobile/data-freshness defaults. |
| Support | Added incident status routing, provider outage help, ticket evidence clarity, and workflow-tied FAQ routing. |
| Alerts | Added usefulness/fatigue/return-conversion/source-reason panel; kept notification usefulness tied to real feedback APIs and analytics events. |
| History | Added replay timeline, symbol continuity, event memory, and research-only trade-autopsy routing. |
| Performance | Added operational dashboard links for p50/p95/p99, retention, cache/stream/provider health, and drilldowns. |

## Accessibility Fixes

- Added shared utility accessibility maturity contract in `frontend/src/lib/ui/utility-accessibility-maturity.ts`.
- Added unit coverage in `frontend/src/lib/ui/utility-accessibility-maturity.test.ts`.
- Added `@axe-core/playwright` and `npm --prefix frontend run test:phase22:utility-accessibility`.
- Added `h1` headings for `/alerts`, `/history`, and `/performance` in legal, locked, and premium states.
- Added accessible notification overlay role/label semantics.
- Enforced cross-browser smoke checks for:
  - Axe critical violations
  - keyboard-visible focus
  - accessible names on visible interactive controls
  - horizontal overflow
  - main landmark
  - page heading

## Production Deployment Proof

Production host:

- `ssh sre@100.68.155.121`
- Path: `/opt/apps/market-alpha-scanner/app`

Deploy commands executed:

```bash
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main
docker compose --env-file .env up -d --build market-alpha-frontend
```

Production commit proof:

```text
84d6427
market-alpha-frontend Up About a minute (healthy)
```

Production image build:

- Built image manifest: `sha256:3c7c9c881d28690641da720ed62502850121c226f1e7e18ae63cbaa2420ae7bf`
- Container recreated and started healthy.

## Production Smoke Proof

Health:

| Check | Result |
| --- | --- |
| `https://tradeveto.com/api/health` | `200`, `ok: true`, service `tradeveto-frontend` |
| `https://tradeveto.com/api/health/deep` | `200`, DB `ok`, scanner `ok`, backup `ok` |

Routes:

| Route | HTTP |
| --- | --- |
| `/account` | 200 |
| `/settings` | 200 |
| `/support` | 200 |
| `/alerts` | 200 |
| `/history` | 200 |
| `/performance` | 200 |
| `/terminal` | 200 |
| `/paper` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/symbol/AMD` | 200 |

## Authenticated Production Utility Proof

A disposable premium probe user was created inside the production container, legal acceptance and premium entitlement were inserted, the pages were fetched with the session cookie, and the probe user was deleted afterward. No session token was printed.

| Route | Marker | Result |
| --- | --- | --- |
| `/account` | `Trust Center` | Present |
| `/settings` | `Preference controls` | Present |
| `/support` | `Workflow FAQ routing` | Present |
| `/alerts` | `Alert utility maturity` | Present |
| `/history?symbol=AMD` | `History utility maturity` | Present |
| `/performance` | `Performance utility maturity` | Present |
| `/api/user/notification-preferences` | authenticated preference API | `authenticated: true` |

## Browser Accessibility Proof

Command:

```bash
TRADEVETO_UTILITY_A11Y_BASE_URL=https://tradeveto.com npm --prefix frontend run test:phase22:utility-accessibility
```

Result:

```text
PHASE22_UTILITY_A11Y_PASSED browsers=3 routes=6 axeCritical=0 artifacts=/Users/hdtv/dev/market-alpha-scanner/docs/ops/artifacts/phase-22-9
```

| Browser | Routes | Axe critical | Horizontal overflow | Unlabeled controls | Keyboard focus |
| --- | ---: | ---: | ---: | ---: | --- |
| Chromium | 6 | 0 | 0 | 0 | Pass |
| WebKit | 6 | 0 | 0 | 0 | Pass |
| Firefox | 6 | 0 | 0 | 0 | Pass |

Screenshot artifacts:

- `docs/ops/artifacts/phase-22-9/chromium-account.png`
- `docs/ops/artifacts/phase-22-9/chromium-settings.png`
- `docs/ops/artifacts/phase-22-9/chromium-support.png`
- `docs/ops/artifacts/phase-22-9/chromium-alerts.png`
- `docs/ops/artifacts/phase-22-9/chromium-history-symbol-AMD.png`
- `docs/ops/artifacts/phase-22-9/chromium-performance.png`
- `docs/ops/artifacts/phase-22-9/webkit-account.png`
- `docs/ops/artifacts/phase-22-9/webkit-settings.png`
- `docs/ops/artifacts/phase-22-9/webkit-support.png`
- `docs/ops/artifacts/phase-22-9/webkit-alerts.png`
- `docs/ops/artifacts/phase-22-9/webkit-history-symbol-AMD.png`
- `docs/ops/artifacts/phase-22-9/webkit-performance.png`
- `docs/ops/artifacts/phase-22-9/firefox-account.png`
- `docs/ops/artifacts/phase-22-9/firefox-settings.png`
- `docs/ops/artifacts/phase-22-9/firefox-support.png`
- `docs/ops/artifacts/phase-22-9/firefox-alerts.png`
- `docs/ops/artifacts/phase-22-9/firefox-history-symbol-AMD.png`
- `docs/ops/artifacts/phase-22-9/firefox-performance.png`
- `docs/ops/artifacts/phase-22-9/utility-accessibility-smoke.json`

## Local Validation

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 491 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |
| `TRADEVETO_UTILITY_A11Y_BASE_URL=http://127.0.0.1:3007 npm --prefix frontend run test:phase22:utility-accessibility` | Pass, Axe critical 0 |

## Remaining Notes

- Chart, scanner, mobile, and data-freshness defaults in Settings are browser-local until server-side profile sync is expanded.
- The production browser accessibility proof was run against public route states; authenticated premium workspace marker proof was run separately inside the production container.
- This phase did not rerun the full Phase 21.9 world-leadership scoring audit.
