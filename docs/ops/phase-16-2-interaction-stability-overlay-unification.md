# Phase 16.2 - Interaction Stability + Overlay System Unification

## Executive Summary

Phase 16.2 focused on stabilizing intelligence interactions across TradeVeto's cinematic product surfaces. The main fix was moving detail interactions onto a single `StableDetailOverlay` primitive with portal rendering, viewport-stable placement, consistent close behavior, scroll preservation, and shared animation classes.

The most important regression found during QA was a mobile scroll jump on `/paper`: opening a cinematic detail overlay changed scroll position by more than 1,300px in emulated iPhone and Android viewports. The root cause was body scroll locking through `position: fixed`, which preserved visual background placement but changed `window.scrollY`. The overlay lock now uses overflow/overscroll containment instead, preserving measured and visible scroll state.

## Interaction Bugs Fixed

- Unified intelligence detail rendering through `StableDetailOverlay`.
- Fixed overlays rendering inline with the page instead of at document root.
- Fixed mobile scroll jump when opening lower-page detail overlays.
- Added stable overlay trigger markers for intelligence zones, orbit nodes, chart expansion controls, and cinematic cards.
- Converted cinematic cluster cards, heatmap cells, and timeline rows from static presentation blocks into clickable detail surfaces.
- Added correct click isolation for nested links and row-level interactions to reduce propagation bugs.
- Added ESC, X close, and optional backdrop close behavior through the shared primitive.
- Added mobile overlay smoke assertions for open/close scroll preservation and clipped/offscreen surfaces.

## Overlay System Architecture

The canonical detail primitive is:

- `frontend/src/components/ui/StableDetailOverlay.tsx`

Key behavior:

- Renders through `createPortal(..., document.body)` so overlays float above the current route instead of being constrained by local stacking contexts.
- Uses `fixed inset-0` positioning with a high z-index.
- Uses a centered desktop surface and bottom-sheet-style mobile surface.
- Keeps a sticky close header visible inside the surface.
- Locks background scrolling through root/body overflow containment without resetting the user's scroll position.
- Restores the original scroll position after close.
- Tracks open, close, and abandon telemetry through the existing modal analytics helpers.

Shared styling lives in:

- `frontend/src/app/globals.css`

The animation system now uses:

- `tv-overlay-backdrop`
- `tv-overlay-surface`
- `tradeveto-overlay-fade`
- `tradeveto-overlay-scale`
- `tradeveto-overlay-sheet`

Reduced-motion users receive animation-free overlay behavior.

## Surfaces Updated

- `frontend/src/components/visual/InteractiveVisualIntelligence.tsx`
  - Intelligence zone grid triggers.
  - Orbit center trigger.
  - Orbit node triggers.

- `frontend/src/components/visual/CinematicIntelligencePanels.tsx`
  - Cluster cards open cluster detail overlays.
  - Cluster item rows open item detail overlays unless they are explicit navigation links.
  - Heatmap cells open centered detail overlays.
  - Timeline items open centered detail overlays.
  - Symbol chips inside details route to `/symbol/{symbol}`.

- `frontend/src/components/charts/InteractivePriceChart.tsx`
  - Expand and chart-area triggers marked for stable overlay QA.

- `frontend/src/components/terminal/SymbolChart.tsx`
  - Expanded chart trigger marked for stable overlay QA.

- `frontend/scripts/mobile-ux-smoke.mjs`
  - Added automated stable overlay interaction checks.
  - Added chart detail scroll preservation checks.
  - Validates overlay opens, close button is visible, surface is not clipped, close works, and scroll does not jump.

## Before / After Interaction Behavior

Before:

- Some details opened inside local page layout.
- Some cinematic cards were visually interactive but did not open detail.
- Some mobile overlays preserved visual background but reset measured scroll position.
- Lower-page overlays could feel like the page moved when opening.
- Interaction behavior differed between charts, cinematic clusters, and intelligence zones.

After:

- Detail surfaces are portaled above the route.
- Cinematic clusters, heat cells, and timeline rows use one overlay pattern.
- Background scroll state is preserved during open and close.
- Desktop overlays center in the viewport.
- Mobile overlays open as a bottom-sheet-style surface with a visible close button.
- Automated smoke checks now fail on scroll jumps, clipped overlays, invisible close buttons, and dead triggers.

## Mobile Fixes

The mobile lock no longer uses `body { position: fixed; top: -scrollY }`, because that can mutate `window.scrollY` on open. The new lock uses:

- `body.style.overflow = "hidden"`
- `documentElement.style.overflow = "hidden"`
- `overscroll-behavior: contain`
- scrollbar compensation on desktop only when needed

This preserves the current scroll offset and avoids Safari/Chrome mobile viewport jumps in automated emulation.

## Transition Improvements

Desktop:

- Backdrop fades in.
- Surface fades and scales in with a calm depth transition.
- Surface remains centered and constrained to the current viewport.

Mobile:

- Surface rises from the bottom as a sheet.
- Safe-area padding is preserved.
- Close header remains sticky.

Reduced motion:

- Overlay animations are disabled.

## Scroll Preservation Validation

Automated mobile emulation caught and then verified the `/paper` fix:

- Initial failing state:
  - `iphone /paper: overlay open changed scroll by 1399px`
  - `android /paper: overlay open changed scroll by 1343px`

- After the scroll-lock change:
  - `npm run test:mobile-ux` passed for 11 routes across iPhone and Android emulation.
  - Screenshots were written to `docs/ops/artifacts/mobile-emulation/`.

Local DB was not configured during mobile emulation, so some data-dependent routes reported that no stable overlay trigger was available for automated local click coverage. Production smoke should be used to validate those populated states.

## Validation Results

Local validation:

- `npm run lint` - passed
- `npm test -- --runInBand` - passed, 400/400
- `npm run build` - passed
- `npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors
- `git diff --check` - passed
- `npm run test:mobile-ux` - passed after scroll-lock fix

## Remaining Interaction Debt

- Data-dependent production-only cards need live smoke coverage after deploy because local mobile emulation runs without `DATABASE_URL`.
- Some older route-specific detail implementations may still exist outside `StableDetailOverlay`; they should be migrated as they are touched.
- Physical-device Safari and Facebook in-app browser testing remains stronger than browser emulation and should be repeated before broad launch.
- Nested interactive content inside cinematic cards is stabilized through propagation guards, but the long-term ideal is a stricter card/action composition standard.

## Final Status

TRADEVETO INTERACTION SYSTEM STABLE
