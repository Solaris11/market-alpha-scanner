# Phase 20.1 - Physical Mobile Certification Lab

Date: 2026-05-21

Final status: `TRADEVETO PHYSICAL MOBILE CERTIFICATION NOT ACCOMPLISHED`

## Executive Summary

Phase 20.1 cannot be certified as accomplished because no real iPhone, Android device, Facebook in-app browser, Instagram in-app browser, or real-device cloud testing credentials were available in this environment.

What was completed:

- Fixed the previously observed production mobile `/paper` overlay clipping failure in emulated mobile QA.
- Pushed the fix to `main` and redeployed production.
- Confirmed production frontend container health.
- Confirmed production route smoke for the required priority routes.
- Re-ran the production mobile UX smoke across iPhone, Android, Facebook iOS, and Instagram iOS emulation profiles.
- Ran the required local validation suite successfully.

What remains blocking:

- Real-device certification on iPhone Safari.
- Real-device certification on Android Chrome.
- Real-device certification inside Facebook in-app browser.
- Real-device certification inside Instagram in-app browser.
- Physical screenshots/videos from those environments.

## Device Availability

| Environment | Result | Evidence |
| --- | --- | --- |
| iPhone Safari | Not tested | `xcrun xctrace list devices` exposed only the local Mac, no attached iPhone. |
| Android Chrome | Not tested | `adb devices -l` returned no attached Android device. |
| Facebook in-app browser | Not tested | No physical device or real-device cloud session available. |
| Instagram in-app browser | Not tested | No physical device or real-device cloud session available. |
| BrowserStack/Sauce/LambdaTest/AWS Device Farm | Not configured | No matching credentials were present in the environment. |

Physical browser versions: unavailable because physical devices/cloud sessions were unavailable.

## Production Deployment

| Item | Result |
| --- | --- |
| Branch | `main` |
| Mobile fix commit | `7dec283 Stabilize mobile fullscreen overlay geometry` |
| Production host | `onsre-node-01` |
| Production app path | `/opt/apps/market-alpha-scanner/app` |
| Production container | `market-alpha-frontend` |
| Container health | `healthy` |

## Fixed Issue

Before the fix, production mobile emulation failed:

- `iphone /paper: stable overlay content clipped offscreen`
- `facebook-ios /paper: stable overlay content clipped offscreen`

Fix implemented in `frontend/src/components/ui/StableDetailOverlay.tsx`:

- Mobile fullscreen overlays now use stable fade-only entrance geometry instead of vertical/scale motion.
- Mobile fullscreen transition duration was shortened to reduce transient viewport clipping risk.
- Desktop overlay behavior was left unchanged.

Post-fix production mobile emulation result:

`MOBILE_UX_SMOKE_PASSED routeChecks=36 devices=4 screenshots=/Users/hdtv/dev/market-alpha-scanner/docs/ops/artifacts/mobile-emulation`

## Production Smoke

Generated at: `2026-05-21T23:58:13.645Z`

| Route | Status | Latency |
| --- | ---: | ---: |
| `/api/health` | 200 | 266ms |
| `/api/health/deep` | 200 | 199ms |
| `/terminal` | 200 | 305ms |
| `/discover` | 200 | 98ms |
| `/scanner` | 200 | 67ms |
| `/paper` | 200 | 123ms |
| `/strategy-labs` | 200 | 69ms |
| `/market-memory` | 200 | 1565ms |

## Mandatory Route Matrix

| Route | Emulated Mobile Smoke | Physical iPhone Safari | Physical Android Chrome | Facebook In-App | Instagram In-App |
| --- | --- | --- | --- | --- | --- |
| `/` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/terminal` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/discover` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/scanner` | Covered by production route smoke; mobile UX route not in script | Not tested | Not tested | Not tested | Not tested |
| `/symbol/AMD` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/paper` | Pass after fix | Not tested | Not tested | Not tested | Not tested |
| `/strategy-labs` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/macro` | Covered by production app, not in mobile UX script | Not tested | Not tested | Not tested | Not tested |
| `/market-memory` | Covered by production route smoke; mobile UX route not in script | Not tested | Not tested | Not tested | Not tested |
| `/feed` | Covered by production app, not in mobile UX script | Not tested | Not tested | Not tested | Not tested |
| `/alerts` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/history` | Pass as `/history?symbol=AMD` | Not tested | Not tested | Not tested | Not tested |
| `/performance` | Pass | Not tested | Not tested | Not tested | Not tested |
| `/account` | Covered by app validation, not in mobile UX script | Not tested | Not tested | Not tested | Not tested |
| `/settings` | Covered by app validation, not in mobile UX script | Not tested | Not tested | Not tested | Not tested |
| `/support` | Covered by app validation, not in mobile UX script | Not tested | Not tested | Not tested | Not tested |
| `/mobile` | Pass | Not tested | Not tested | Not tested | Not tested |

## Mandatory Validation Matrix

| Validation Area | Emulated Result | Physical Result |
| --- | --- | --- |
| Overlay scroll preservation | `/paper` mobile clipping failure fixed in emulation; automated smoke passed | Not certified |
| Viewport stability | No mobile smoke failure after fix | Not certified |
| Safari address bar collapse behavior | Not reproducible in local emulation with full confidence | Not certified |
| Keyboard resize handling | Not covered by current automated smoke | Not certified |
| Fullscreen chart behavior | Automated script noted manual chart QA still required for `/symbol/AMD` | Not certified |
| Scanner touch workflows | Route smoke passed; physical touch throughput not tested | Not certified |
| One-handed navigation | Emulated screenshots produced; physical ergonomics not tested | Not certified |
| Touch latency | Not measurable without real device/cloud session | Not certified |
| Bottom sheet stability | No automated mobile smoke failure after overlay fix | Not certified |
| Modal close behavior | No automated mobile smoke failure after overlay fix | Not certified |
| Scroll restoration | `/paper` emulation passed after fix | Not certified |
| Horizontal overflow | No automated mobile smoke failure after fix | Not certified |
| Hydration mismatches | No mobile smoke hydration failure observed | Not certified |
| Sticky/fixed elements | No automated mobile smoke failure after fix | Not certified |
| Clipped overlays | Prior `/paper` emulation failure resolved | Not certified |
| Inaccessible actions | Not fully certified without physical touch QA | Not certified |

## `/paper` Critical Blocker Retest

Required scenario:

1. Deep scroll on `/paper`.
2. Open stable overlay.
3. Close overlay.
4. Verify exact scroll restoration.
5. Repeat on iPhone Safari, Android Chrome, Facebook in-app, and Instagram in-app.

Result:

- Emulated production smoke passed after the overlay geometry fix.
- Physical-device retest was not completed because no supported devices or real-device cloud sessions were available.

Certification impact:

- The prior production emulation regression is fixed.
- The Phase 20.1 physical certification requirement remains unmet.

## Screenshot Artifacts

Emulated mobile screenshots were generated at:

`docs/ops/artifacts/mobile-emulation`

These are useful regression artifacts, but they are not physical-device proof. No real-device screenshots or videos were captured.

## Local Validation

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend test -- --runInBand` | Passed: 453 tests, 0 failures |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix frontend audit --omit=dev` | Passed: 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Passed: 0 errors, 0 warnings |

## Remaining Issues

- Physical iPhone Safari testing is still required.
- Physical Android Chrome testing is still required.
- Facebook and Instagram in-app browser testing is still required.
- Physical videos/screenshots are still required.
- Manual fullscreen chart QA remains required on real devices.
- Keyboard resize and Safari address bar behavior remain unverified on physical devices.
- Touch latency, one-handed scanner workflows, and true bottom-sheet feel remain unverified on physical devices.

## Certification Decision

TradeVeto improved during this phase because the known `/paper` mobile overlay failure was fixed and verified in production emulation. However, the sprint explicitly requires real physical-device certification. That requirement was not met in this environment.

`TRADEVETO PHYSICAL MOBILE CERTIFICATION NOT ACCOMPLISHED`
