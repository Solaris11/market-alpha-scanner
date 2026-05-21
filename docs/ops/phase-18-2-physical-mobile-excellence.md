# Phase 18.2 - Physical Mobile Device Excellence

## Objective

Phase 18.2 targeted real-world mobile-native quality across iPhone Safari, Android Chrome, Facebook in-app browser, and Instagram in-app browser where possible.

The implementation work focused on the mobile issues that can be fixed and regression-tested from the shared development and production environment:

- Safari visual viewport and keyboard-resize stability
- fixed-body scroll locking for overlays, drawers, and discovery
- bottom-sheet and overlay sizing against visual viewport height
- safe-area aware mobile surfaces
- momentum scrolling and overscroll containment
- touch target density
- chart fullscreen viewport sizing
- scroll-position preservation on overlay open and close
- production mobile smoke coverage for high-priority routes

## Implementation Summary

### Mobile Viewport System

Added a shared mobile viewport utility:

- `frontend/src/lib/client/mobile-viewport.ts`

The utility derives stable metrics from `window.visualViewport` and writes deterministic CSS custom properties:

- `--tv-visual-viewport-height`
- `--tv-visual-viewport-width`
- `--tv-keyboard-offset`

This gives mobile overlays, discovery, drawers, and fullscreen charts a consistent viewport reference instead of relying only on `100vh`, which is unstable on Safari and in-app browsers.

### Mobile Scroll Lock

Added a shared fixed-body scroll lock:

- `frontend/src/lib/client/mobile-scroll-lock.ts`

The scroll lock preserves the current page position while overlays are open and restores it after close without layout jump. It snapshots body/html style fields, applies fixed positioning, and restores scroll with immediate and deferred correction passes.

### Unified Overlay Stability

Updated stable overlays to use the shared mobile viewport and scroll lock system:

- `frontend/src/components/ui/StableDetailOverlay.tsx`

Fixes included:

- mobile visual viewport sizing
- stable fixed positioning
- scroll preservation on open/close
- trigger-aware scroll capture
- reduced stale pre-scroll capture windows
- mobile-safe surface sizing
- consistent close behavior

### Discovery Mobile Hardening

Updated global discovery:

- `frontend/src/components/discovery/GlobalIntelligenceDiscovery.tsx`

Fixes included:

- shared viewport CSS variables
- fixed-body scroll lock
- safe-area header padding
- mobile-safe scroll body
- touch-safe gesture exclusions

### Terminal Navigation Mobile Hardening

Updated Terminal navigation:

- `frontend/src/components/terminal/TerminalNav.tsx`

Fixes included:

- mobile drawer visual viewport sizing
- stable backdrop sizing
- shared scroll lock
- safer touch targets

### Chart Fullscreen Mobile Sizing

Updated interactive charts:

- `frontend/src/components/charts/InteractivePriceChart.tsx`

The expanded chart canvas now uses the shared mobile fullscreen viewport class so fullscreen chart surfaces are less exposed to browser chrome and keyboard viewport shifts.

### Global Mobile CSS

Updated:

- `frontend/src/app/globals.css`

Added mobile primitives:

- `.tv-native-scroll`
- `.tv-mobile-fixed-viewport`
- `.tv-mobile-touch-target`
- `.tv-mobile-safe-bottom`
- mobile sizing rules for discovery, stable overlays, and expanded charts

## Regression Coverage

Added tests:

- `frontend/src/lib/client/mobile-viewport.test.ts`

Coverage includes:

- visual viewport dimensions
- Safari visual viewport offset behavior
- deterministic pixel CSS variable output

Updated:

- `frontend/scripts/mobile-ux-smoke.mjs`

The mobile smoke now understands fixed-body scroll lock and measures visual scroll stability correctly when the body is intentionally fixed during overlay state.

## Production Deployment

Production was updated through the required production-first loop.

Latest deployed runtime commit:

- `4d261ab` - `Tune mobile overlay scroll capture`

Production frontend container:

- `market-alpha-frontend`
- status: healthy

Production health checks:

- `/api/health`: OK
- `/api/health/deep`: OK

Production route smoke returned HTTP 200 for:

- `/`
- `/terminal`
- `/discover`
- `/opportunities`
- `/symbol/AMD`
- `/mobile`
- `/dashboard`
- `/paper`
- `/strategy-labs`
- `/alerts`
- `/performance`
- `/history?symbol=AMD`

## Production Mobile Emulation QA

Command:

```bash
TRADEVETO_MOBILE_UX_BASE_URL=https://tradeveto.com npm --prefix frontend run test:mobile-ux
```

Result:

```text
MOBILE_UX_SMOKE_PASSED routes=11 devices=2 screenshots=/Users/hdtv/dev/market-alpha-scanner/docs/ops/artifacts/mobile-emulation
```

Screenshots were captured for iPhone and Android emulation under:

- `docs/ops/artifacts/mobile-emulation`

The automated run still reported manual QA notes for surfaces without stable automated overlay/chart triggers. Those notes do not fail the smoke suite, but they remain relevant manual QA coverage gaps.

## Physical Device Availability Check

Physical-device verification could not be completed from this environment.

Device/tool checks:

- `adb`: not installed / unavailable
- `idevice_id`: not installed / unavailable
- `system_profiler SPUSBDataType`: no iPhone, iPad, Android, Pixel, Samsung, OnePlus, Motorola, Xiaomi, or Huawei devices detected
- `xcrun xctrace list devices`: detected only the MacBook Pro host

Detected devices:

```text
== Devices ==
DJ MG's MacBook Pro (2BD19BA4-846E-5D8C-A615-5509927BE4ED)
```

Therefore the mandatory real-device matrix was not satisfied:

- iPhone Safari: not physically tested
- Android Chrome: not physically tested
- Facebook in-app browser: not physically tested
- Instagram in-app browser: not physically tested

## Validation

Local validation completed successfully:

- `npm --prefix frontend run lint`: passed
- `npm --prefix frontend test -- --runInBand`: passed, 424 tests
- `npm --prefix frontend run build`: passed
- `npm --prefix frontend audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed

Production validation completed successfully for deploy health, route availability, and emulator-based mobile smoke.

## Remaining Mobile Debt

The implementation materially improves mobile viewport stability, scroll preservation, overlay behavior, discovery stability, navigation drawer behavior, and chart fullscreen sizing.

The blocking gap is proof, not code coverage:

- no physical iPhone Safari session was available
- no physical Android Chrome session was available
- no Facebook in-app browser test was available
- no Instagram in-app browser test was available
- no physical touch-latency or gesture smoothness measurements were possible
- no real Safari keyboard-resize recording was possible
- no real in-app browser safe-area and viewport-chrome behavior could be validated

## Required Next Work

To complete Phase 18.2, run the production build on real devices and record:

- iPhone Safari route smoke and overlay QA
- iPhone Safari keyboard and bottom-sheet QA
- Android Chrome route smoke and overlay QA
- Android Chrome chart fullscreen QA
- Facebook in-app browser route, overlay, safe-area, and scanner QA
- Instagram in-app browser route, overlay, safe-area, and scanner QA where possible
- physical screenshot/video evidence for Terminal, Discover, Symbol Detail, Alerts, Paper, Strategy Labs, and mobile chart fullscreen

Any device-specific defects found there should be fixed, redeployed, and re-tested on the same physical devices.

## Final Verdict

TRADEVETO PHYSICAL MOBILE EXCELLENCE NOT ACCOMPLISHED
