# Phase 23.0 - Notification Overlay Toggle + Close UX Fix

Date: 2026-05-23

Production target: `https://tradeveto.com`

Status: `LOCAL VALIDATION PASSED - PRODUCTION DEPLOY PENDING`

## Issue Summary

The notification drawer had been moved into a safer mobile viewport position, but it still had a critical dismissal problem:

- No clear visible close button was available in the drawer header.
- Users could not reliably dismiss notifications like a normal app drawer.
- Browser back could close the experience indirectly, but that could also navigate away from the current route.
- Mobile users needed a safe drawer that opened and closed without route/history side effects.

## Before Behavior

Before this fix:

- The notification bell opened the drawer, but there was no first-class visible `X` close control.
- The only element with `aria-label="Close notifications"` was the mobile backdrop, not a visible header action.
- Focus was not deliberately moved into the drawer or restored to the bell after close.
- Multiple mounted notification bells could theoretically produce duplicate drawer state.
- Outside-click behavior existed, but it did not prevent accidental underlying route clicks.

## Implemented Behavior

Updated `frontend/src/components/notifications/NotificationBell.tsx`:

- Notification bell is now an explicit dialog toggle:
  - closed -> click opens
  - open -> click closes
- Added `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, and `data-notification-bell="true"` on the bell.
- Added a visible header close button with accessible label `Close notifications`.
- Added a lucide `X` icon inside the close button.
- Drawer now renders with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- Escape closes the drawer.
- Outside pointer down closes the drawer in the capture phase and prevents underlying link/button activation.
- Clicking inside the drawer does not close it.
- Closing restores focus to the notification bell with `preventScroll`.
- Opening one notification drawer dispatches a local window event so peer notification bell instances close instead of allowing duplicate overlays.
- Clicking a notification action still intentionally navigates to that action URL; plain open/close operations do not navigate.

Updated `frontend/src/app/globals.css`:

- Added a transparent desktop click layer class.
- Made notification backdrop/click layer pointer-events-free so the notification bell remains tappable while the drawer is open.
- Added max-width guards for the drawer on mobile and desktop.

Updated `frontend/tests/browserstack/mobile-real-device.spec.ts`:

- Added focused mobile regression coverage across:
  - `/terminal`
  - `/alerts`
  - `/symbol/AMD`
- Added assertions for:
  - opens from bell
  - closes from bell toggle
  - closes from visible close button
  - clicking inside does not close
  - clicking outside closes
  - Escape closes
  - route path is preserved
  - browser history length is preserved
  - scroll position is preserved
  - drawer is a dialog
  - close button is visible
  - mobile drawer geometry remains within viewport
  - notification cards remain scrollable and unclipped
  - bottom nav does not overlap the drawer

## Local Validation

Required validation passed:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 491 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |

Focused local Playwright validation against `http://127.0.0.1:3017`:

```bash
TRADEVETO_MOBILE_UX_BASE_URL=http://127.0.0.1:3017 \
TRADEVETO_BROWSERSTACK_ARTIFACT_ROOT=../docs/ops/artifacts/phase-23-0-local \
npx playwright test --config=playwright.phase21.config.ts \
  -g "notification overlay mobile safe area|notification drawer toggle" \
  --workers=1
```

Result:

```text
2 passed
```

## Local Screenshots

Local mobile Playwright screenshots were captured under:

```text
docs/ops/artifacts/phase-23-0-local/browserstack-screenshots/
```

Files:

- `phase21-mobile-real-device-notifications-open.png`
- `phase21-mobile-real-device-notifications-scrolled-bottom.png`

These are local Playwright screenshots, not BrowserStack real-device screenshots.

## Mobile QA Notes

Local iPhone-profile Playwright validation confirmed:

- Drawer opens from the bell.
- Drawer closes from the bell toggle.
- Drawer closes from the visible close button.
- Drawer closes from outside click.
- Drawer remains open when clicking inside the panel.
- Drawer closes on Escape.
- Route path and browser history length remain unchanged during open/close.
- Scroll position remains stable during open/close.
- Drawer geometry stays inside the mobile viewport.
- Drawer has internal scrolling.
- Notification cards are not clipped at the top or bottom.
- Drawer clears the mobile bottom nav.

## Production Deployment

Pending.

## Production Smoke

Pending.

Required production smoke after deploy:

- `/api/health`
- `/api/health/deep`
- `/terminal`
- `/alerts`
- `/symbol/AMD`
- `/discover`
- `/scanner`

## Remaining Blockers

Pending production deploy and smoke.

## Final Verdict

Pending production validation.
