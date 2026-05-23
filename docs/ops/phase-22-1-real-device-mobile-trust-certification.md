# Phase 22.1 - Real-Device Mobile Trust Certification

Date: 2026-05-23

Production target: `https://tradeveto.com`

Final status: `TRADEVETO REAL-DEVICE MOBILE TRUST CERTIFICATION NOT ACCOMPLISHED`

## Scope

Phase 22.1 targeted production mobile certification on real devices:

- iPhone Safari
- Android Chrome
- iPad Safari
- Physical iPhone
- Physical iPad
- Physical Android
- Facebook in-app browser
- Instagram in-app browser

The required workflow surfaces were risk acknowledgement, notifications, `/paper` deep scroll overlays, `/macro` overlays, `/terminal`, `/discover`, `/scanner`, `/symbol/AMD` chart fullscreen, `/alerts`, `/feed`, and `/market-memory`.

## Implementation

The BrowserStack/Playwright suite was expanded for Phase 22.1:

- BrowserStack build name updated to `phase-22-1-real-device-mobile-trust-certification`.
- Added iPad Safari platform: `iPad Pro 13 2024 / Safari / iOS 17`.
- Added `npm --prefix frontend run test:phase22:mobile-real-device`.
- Moved Phase 22.1 Playwright output to `docs/ops/artifacts/phase-22-1`.
- Added a first-class risk acknowledgement safe-area test:
  - CTA visibility
  - checkbox visibility
  - bottom-nav clearance
  - viewport containment
  - horizontal overflow
  - dismiss/tap behavior
- Added a first-class notification overlay safe-area test:
  - authenticated notification drawer path with mocked authenticated notification API responses inside the browser test
  - card wrapping
  - internal scroll
  - bottom safe-area clearance
  - bottom-nav clearance
  - overlay close behavior
- Kept the existing production route matrix and stable overlay checks for:
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

## Local Validation

All local validation completed before the production pull:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 480 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |

Additional local mobile validation:

`TRADEVETO_MOBILE_UX_BASE_URL=https://tradeveto.com TRADEVETO_BROWSERSTACK_ARTIFACT_ROOT=../docs/ops/artifacts/phase-22-1-local npx playwright test --config=playwright.phase21.config.ts --workers=1 --timeout=180000`

Result:

| Test | Result |
| --- | --- |
| Risk acknowledgement overlay mobile safe area | Pass |
| Notification overlay mobile safe area | Pass |
| Real-device mobile QA required routes, local WebKit emulation | Pass |

Local mobile suite result: `3 passed`.

## Production Deployment Proof

Production host: `sre@100.68.155.121`

Production path: `/opt/apps/market-alpha-scanner/app`

Deployment actions:

- Local commit: `870ea7d0`
- Pushed to `origin/main`
- Production `git pull --ff-only origin main` fast-forwarded from `fd59979` to `870ea7d`
- Container rebuild was not run because this change updated BrowserStack/Playwright certification config and tests, not runtime application code.
- Existing production frontend container remained healthy.

Production container proof:

- `market-alpha-frontend`: `Up 2 hours (healthy)`
- Production checkout after pull: `870ea7d`

## Production Smoke

Health:

| Check | HTTP | Time | Result |
| --- | ---: | ---: | --- |
| `/api/health` | 200 | 0.102972s | Pass |
| `/api/health/deep` | 200 | 0.146831s | Pass, DB ok, scanner ok, backup ok |

Route smoke:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/terminal` | 200 | 0.150315s |
| `/discover` | 200 | 0.111299s |
| `/scanner` | 200 | 0.175862s |
| `/paper` | 200 | 0.135281s |
| `/macro` | 200 | 0.250891s |
| `/symbol/AMD` | 200 | 0.281364s |
| `/alerts` | 200 | 0.096301s |
| `/feed` | 200 | 0.200109s |
| `/market-memory` | 200 | 0.144778s |

## BrowserStack Real-Device Attempts

Command run on production:

`npm --prefix frontend run test:phase22:mobile-real-device`

Production artifact logs:

- `docs/ops/artifacts/phase-22-1/browserstack-real-device.log`
- `docs/ops/artifacts/phase-22-1/browserstack-real-device-retry.log`
- `docs/ops/artifacts/phase-22-1/browserstack-playwright-report.json`

### Attempt 1

BrowserStack build URL:

- `https://automation.browserstack.com/builds/m9lvryxis0edsnykhtxlibrvuhdscwf3syiluopf`

Result:

- BrowserStack SDK failed during startup with `DEADLINE_EXCEEDED`.
- BrowserStack SDK then failed config modification with `SyntaxError: "[object Object]" is not valid JSON`.
- No browser sessions were usable.
- Hung SDK processes were terminated.

### Attempt 2

BrowserStack build URL:

- `https://automation.browserstack.com/builds/uekbci6j3tz14ig1yhdt5ookmzyboyzdsvcgzwyg`

BrowserStack report summary:

| Metric | Count |
| --- | ---: |
| Expected | 0 |
| Unexpected | 3 |
| Skipped | 6 |
| Flaky | 0 |

Device/browser matrix:

| Device / Browser | Required? | Result | Session URL | Screenshot/video |
| --- | --- | --- | --- | --- |
| iPhone 15 Pro Max / Safari / iOS 17 | Yes | Failed before browser connection: `Automate testing time expired` | Unavailable | Unavailable |
| Samsung Galaxy S23 Ultra / Chrome / Android 13 | Yes | Failed before browser connection: `Automate testing time expired` | Unavailable | Unavailable |
| iPad Pro 13 2024 / Safari / iOS 17 | Yes, if supported | Failed before browser connection: `Automate testing time expired` | Unavailable | Unavailable |

Test outcome:

| Project | Risk acknowledgement | Notification overlay | Route matrix |
| --- | --- | --- | --- |
| `iphone-15-pro-max-safari` | Failed before execution | Skipped | Skipped |
| `samsung-galaxy-s23-ultra-chrome` | Failed before execution | Skipped | Skipped |
| `ipad-pro-13-2024-safari` | Failed before execution | Skipped | Skipped |

Failure message for all attempted platforms:

`browserType.connect: Error: Automate testing time expired.`

## Physical Device QA

Physical/manual QA was not completed in this run.

| Device/context | Result | Evidence |
| --- | --- | --- |
| Physical iPhone Safari | Not captured | No screenshot/video artifact |
| Physical iPad Safari | Not captured | No screenshot/video artifact |
| Physical Android Chrome | Not captured | No screenshot/video artifact |
| Facebook in-app browser | Not captured | No screenshot/video artifact |
| Instagram in-app browser | Not captured | No screenshot/video artifact |

No physical or in-app browser proof is claimed.

## Certification Assessment

Not accomplished.

The suite is stronger and local production-targeted mobile validation passed, but the required certification depends on real-device evidence. BrowserStack did not start usable device sessions, and physical/in-app browser proof was not captured.

## Remaining Blockers

- BrowserStack Automate account/runtime must provide usable real-device browser minutes. Current production runs still fail with `Automate testing time expired`.
- Re-run `npm --prefix frontend run test:phase22:mobile-real-device` after BrowserStack access is verified.
- Capture passing session URLs, videos, screenshots, console logs, and network logs for:
  - iPhone Safari
  - Android Chrome
  - iPad Safari
- Complete physical-device QA with screenshots/videos for:
  - iPhone
  - iPad
  - Android
  - Facebook in-app browser
  - Instagram in-app browser
- Only then re-evaluate for `ACCOMPLISHED` or `STRONG PARTIAL ACCOMPLISHED`.

## Final Verdict

`TRADEVETO REAL-DEVICE MOBILE TRUST CERTIFICATION NOT ACCOMPLISHED`
