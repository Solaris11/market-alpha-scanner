# Phase 11.10 Mobile/PWA Launch Hardening

This pass hardens the browser-based mobile app before native iOS/Android shells. No native app launch was performed.

## Audit Scope

Mobile surfaces reviewed:

- `/mobile`
- `/terminal`
- `/dashboard`
- `/opportunities`
- `/history`
- `/paper`
- `/strategy-labs`
- `/symbol/AMD`
- PWA manifest and service worker
- Push subscription status, subscribe, unsubscribe, test, and intelligence send flow

## Improvements Applied

### PWA Installability

- Added a dedicated install card for the mobile web app.
- Added automatic browser install prompt handling through `beforeinstallprompt`.
- Added iOS manual install guidance for Safari Home Screen installs.
- Added installed-state detection through standalone display mode.
- Added a manifest check link for operator and beta-user debugging.

### Manifest Hardening

- Added a 192x192 PNG icon.
- Added explicit 192 and 512 icon entries.
- Added a maskable 512 icon entry.
- Added `display_override`, `launch_handler`, `prefer_related_applications`, screenshots, and shortcuts.
- Kept `start_url` on `/mobile?source=pwa` so PWA launches into the mobile workflow.

### Service Worker Hardening

- Added install and activate handlers with `skipWaiting()` and `clients.claim()`.
- Hardened notification click routing with absolute same-origin URLs.
- Kept the service worker push-only and lightweight; no offline cache is introduced yet.

### Mobile Layout Hardening

- Added a mobile readiness checklist directly on `/mobile`.
- Reduced mobile hero heading size and forced safer wrapping.
- Made primary mobile actions full-width on small screens.
- Made packet actions and push buttons easier to tap.
- Kept bottom navigation safe-area padding through the existing `TerminalShell`.

## Mobile Readiness Checklist

| Area | Status | Notes |
| --- | --- | --- |
| Manifest | Ready | Name, icons, shortcuts, screenshots, scope, start URL configured. |
| Install flow | Ready for beta | Browser prompt on supported browsers, manual iOS guidance otherwise. |
| Push permission flow | Ready for beta | Permission, subscription, unsubscribe, test, and current-packet actions exist. |
| Service worker | Ready for push beta | Push/click/install/activate handlers are lightweight and safe. |
| Mobile nav | Ready for beta | Drawer and bottom nav are touch-oriented; route density should keep being monitored. |
| Native app parity | Not complete | Store builds, signing, native deep links, native notification categories, and native analytics remain future work. |

## Native App Gap Analysis

Native shells are still needed for:

- App Store / Play Store distribution.
- Native push permission education and notification categories.
- Deep link and universal link handling outside browser constraints.
- Native biometric/session affordances if required later.
- App review metadata, privacy labels, store screenshots, and signing certificates.
- Mobile crash reporting at native shell level.

## Validation Notes

- Local Chrome mobile viewport screenshot captured for `/mobile`.
- Production route budget check passed for core deployed routes.
- Production `/mobile` returned 404 because the mobile route is present locally but not deployed in the currently live build.
- Local monitoring synthetics could not post because `TRADEVETO_MONITORING_TOKEN` is not configured in this dev environment.

## Remaining Mobile Risks

- Need authenticated mobile viewport screenshots for premium-only dashboard, push, replay, portfolio/scenario, and copilot states.
- Need real-device iOS Safari Home Screen install validation.
- Need Android Chrome install prompt validation on a physical device.
- Need push delivery validation with production VAPID keys and real mobile browsers.
- Need deploy verification after the `/mobile` route ships to production.

## Current Score

Mobile/PWA controlled-beta readiness estimate: **88/100**.

To move above 95:

- Validate install and push on physical iOS and Android devices.
- Capture authenticated premium mobile screenshots across terminal, opportunities, replay, strategy labs, and portfolio/scenario.
- Add browser/session-aware mobile performance checks.
- Deploy `/mobile` and confirm public route availability.
- Add native shell plan with store assets, privacy labels, signing, and deep-link behavior.

Final status: MOBILE STILL NEEDS HARDENING
