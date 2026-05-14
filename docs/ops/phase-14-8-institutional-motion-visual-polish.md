# Phase 14.8 - Institutional Motion + Visual Polish

Date: 2026-05-13

## Executive Summary

Phase 14.8 adds a restrained motion and polish layer across TradeVeto without changing intelligence scoring, entitlement logic, billing, or production data flows.

The work focuses on:

- subtle page, card, drawer, chart, score, alert, and skeleton motion
- consistent semantic color utilities for constructive, caution, elevated risk, dangerous, intelligence, and neutral states
- reduced-motion accessibility behavior
- presentation mode for investor demos, beta walkthroughs, and clean social screenshots
- sensitive/admin/user-data hiding while presentation mode is active

This is a visual and interaction polish pass only. No trading logic, scoring logic, scanner logic, or billing logic was changed.

## Motion System

Added shared motion utilities:

- `tv-page-motion` for soft route entry
- `tv-card-motion` for subtle hover depth on interactive cards
- `tv-tap-motion` for tactile tap/active states
- `tv-drawer-surface` for drawer/menu entrance motion
- `tv-skeleton` for calmer loading shimmer
- `tv-chart-reveal` for chart/progress reveal
- `tv-score-change` for restrained score emphasis
- `tv-alert-pulse` for unread alert attention

Motion is intentionally low-amplitude. It avoids aggressive glow, casino-like pulses, or distracting chart animation.

## Design System Polish

Refined global visual language with:

- motion timing tokens
- shared easing token
- semantic status color tokens
- consistent card hover depth
- consistent active/tap affordance
- cleaner loading skeleton behavior
- reusable presentation-mode selectors

The polish is applied to terminal shell, terminal header, nav links, account menu, notification menu, glass panels, metric cards, gauges, mini charts, and loading skeletons.

## Status Color Semantics

Added a small semantic tone policy in `frontend/src/lib/ui/visual-polish.ts`.

Color meanings:

- green: constructive
- yellow: caution
- orange: elevated risk
- red: dangerous
- purple/cyan: replay/intelligence
- blue: neutral/system

The tone labels intentionally avoid buy/sell language so color never implies trading advice.

## Presentation Mode

Added `PresentationModeController`.

Supported URL flags:

- `?presentation=1`
- `?demo=true`
- `?present=yes`

When enabled, presentation mode:

- persists locally until exited
- sets `html[data-tradeveto-presentation="true"]`
- hides elements marked with `data-sensitive`
- hides beta feedback widget
- hides account/admin/user controls that would distract demos
- applies a cleaner demo background
- shows a small operator-only exit badge on desktop

Sensitive UI marked for hiding:

- account menu
- account pill
- notification bell
- beta feedback widget
- user email/display name in mobile navigation
- sign-out action

## Accessibility

Added `prefers-reduced-motion: reduce` handling for the new motion classes.

Reduced-motion mode disables:

- page entry animation
- drawer entry animation
- alert pulse
- chart reveal
- score pop
- skeleton shimmer
- card/tap transitions

## Local Validation

Completed locally before commit:

- `npm run lint` - passed
- `npm test -- --runInBand` - passed
- `npm run build` - passed
- `npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings
- `git diff --check` - passed

Local route smoke:

- `/terminal?presentation=1` - 200
- `/opportunities?presentation=1` - 200
- `/performance?presentation=1` - 200

## Production Validation

Production validation must run from:

`ssh sre@100.68.155.121`

`cd /opt/apps/market-alpha-scanner/app`

Production validation status: pending until pushed, pulled, rebuilt, and smoke-tested on the production host.

## Remaining Visual Risks

- Presentation mode hides sensitive UI by selector. New future user/admin widgets should be marked with `data-sensitive` when they should not appear in investor/demo screenshots.
- Motion polish is intentionally broad but conservative. Page-specific microinteractions can be further tuned after beta users react to the new feel.
- Current screenshots can still be interrupted by the legal risk acknowledgement modal on fresh sessions; this is expected and should not be bypassed for real users.

## Verdict

Local implementation is complete. Production deploy and validation are required before final closure.

