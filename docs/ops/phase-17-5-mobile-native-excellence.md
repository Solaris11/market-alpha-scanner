# Phase 17.5 - Mobile Native Excellence

## Objective

Make TradeVeto feel native-mobile-first through route gestures, fullscreen intelligence drilldowns, fullscreen chart-compatible overlays, stronger bottom sheets, one-handed scanner access, mobile feed optimization, and mobile overlay polish.

## Implemented Systems

### Global Mobile Gesture Layer

- Added `MobileNativeGestureLayer` to `TerminalShell`.
- Supports horizontal route swipes across the primary mobile navigation stack.
- Uses the existing bottom-nav route model so gestures stay aligned with visible navigation.
- Displays a short native-style route hint such as `Next: Scanner` or `Back: Ideas`.
- Ignores overlays, drawers, form controls, buttons, and horizontal scrollers to avoid accidental navigation.

### Fullscreen Intelligence Drilldowns

- Upgraded `StableDetailOverlay` so `size="xl"` becomes a true fullscreen mobile drilldown.
- Fullscreen mode uses `100dvh`, safe-area-aware header padding, fixed scroll preservation, and stable close behavior.
- Non-fullscreen mobile details remain bottom sheets with drag-to-close.
- Drag-to-close is disabled for fullscreen intelligence and chart surfaces so a chart/detail page does not accidentally dismiss while the user explores it.

### Bottom Sheet / Drawer Polish

- Mobile navigation drawer now preserves safe-area padding.
- Drawer body uses native momentum scrolling and overscroll containment.
- Drawer can close with a horizontal swipe gesture.
- Drawer/backdrop opt out of global route gestures to prevent conflicting behavior.

### One-Handed Scanner UX

- `/mobile` priority actions now put `One-hand scanner` first and link directly to `/discover`.
- Mobile priority actions are a swipeable thumb-friendly rail on small screens and a grid on larger screens.
- The rail is marked as gesture-owned so horizontal scrolling does not trigger route navigation.

### Mobile Feed Optimization

- Replaced passive mobile intelligence cards with `MobileIntelligenceDeck`.
- Packets are now swipeable, visual, score-ring-backed cards.
- Tapping a packet opens a fullscreen intelligence drilldown with:
  - score ring
  - urgency/category/symbol chips
  - evidence label
  - reason codes
  - action link
  - research-only trust note
- Uses only the existing `MobileIntelligencePacket` data. No fabricated mobile intelligence was added.

### Gesture Conflict Controls

- Added gesture-ignore boundaries for:
  - `MobileModeRail`
  - `PersonalizedMobileQuickAccess`
  - mobile packet deck
  - mobile priority action rail
  - stable overlays
  - mobile drawer and backdrop
- Added `.tv-native-scroll` for native-feeling inertial scrolling in overlays and drawer panels.

## Data / Realism Rules

- Mobile packet cards use the server-generated mobile intelligence center.
- Fallback state remains explicit when packets are unavailable.
- No fake scores, fake charts, fake alerts, or fake mobile notifications were introduced.

## Validation

Local validation status:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 415 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings.
- `git diff --check` - passed.

Production validation status:

- Production pull/rebuild - passed. Production fast-forwarded to `7d91a97` and rebuilt `market-alpha-frontend`.
- Container health - passed. `market-alpha-frontend` reported `healthy`.
- `/api/health` - passed, HTTP 200.
- `/api/health/deep` - passed, HTTP 200.
- Production route smoke - passed for `/mobile`, `/terminal`, `/discover`, `/opportunities`, `/symbol/AMD`, and `/alerts`.
- Public edge smoke - passed for `https://tradeveto.com/api/health` and `https://tradeveto.com/mobile`.

## Physical Device QA

Mandatory physical QA requirement:

- iPhone Safari - not completed in this environment.
- Android Chrome - not completed in this environment.
- Facebook in-app browser - not completed in this environment.

This is a hard acceptance blocker. Desktop/mobile emulation and production smoke can reduce risk, but they do not satisfy the explicit physical-device requirement.

## Remaining Mobile Debt

- Complete real physical-device testing on iPhone Safari, Android Chrome, and Facebook in-app browser.
- Confirm iOS Safari viewport behavior with fullscreen `100dvh` overlays and installed PWA mode.
- Confirm Android Chrome scroll/gesture behavior against nested carousels and bottom nav.
- Confirm Facebook in-app browser safe-area, keyboard resize, and body scroll behavior.
- Capture physical-device screenshots or video proof after deployment.

## Verdict

TRADEVETO MOBILE NATIVE EXCELLENCE NOT ACCOMPLISHED
