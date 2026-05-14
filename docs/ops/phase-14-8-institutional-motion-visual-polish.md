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

Production-sensitive checks were run from the production host:

- host: `onsre-node-01`
- user: `sre`
- path: `/opt/apps/market-alpha-scanner/app`
- deployed commit: `d743337cdd4e65217b0e2356658433169ccd3a04`
- docker frontend service: `market-alpha-frontend`

Production deploy:

- `git pull --ff-only origin main` - fast-forwarded from `b599ee2` to `d743337`
- `docker compose up -d --build market-alpha-frontend` - passed
- `market-alpha-frontend` - healthy
- `market-alpha-scanner-market-alpha-postgres-1` - healthy

Production health:

- `/api/health` - 200, `ok: true`, service `tradeveto-frontend`
- `/api/health/deep` - 200, DB ok, scanner ok, local backup ok, R2/offsite backup ok
- scanner freshness at check time: about 3 minutes
- R2 backup age at check time: about 53 minutes

Production route smoke:

| Route | Status | Time |
| --- | ---: | ---: |
| `/` | 200 | 0.190s |
| `/terminal?presentation=1` | 200 | 0.114s |
| `/opportunities?presentation=1` | 200 | 0.124s |
| `/performance?presentation=1` | 200 | 0.157s |
| `/dashboard?presentation=1` | 200 | 0.119s |
| `/mobile?presentation=1` | 200 | 0.120s |
| `/symbol/AMD?presentation=1` | 200 | 0.201s |
| `/api/health` | 200 | 0.171s |
| `/api/health/deep` | 200 | 0.234s |

Production mobile user-agent smoke:

| Route | Status | Time |
| --- | ---: | ---: |
| `/terminal?presentation=1` | 200 | 0.320s |
| `/opportunities?presentation=1` | 200 | 0.255s |
| `/performance?presentation=1` | 200 | 0.243s |
| `/mobile?presentation=1` | 200 | 0.187s |
| `/symbol/AMD?presentation=1` | 200 | 0.295s |

Production validation commands:

- `git diff --check` - passed
- `npm run lint` - passed
- `npm test -- --runInBand` - passed, 387 tests
- `npm run build` - passed
- `npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings

Performance budget:

- `tools/ops/tradeveto-performance-budget-check.sh` - passed
- result: `PERFORMANCE BUDGET CHECK PASSED`
- checked public routes, app routes, protected API routes, and portfolio scenario API fail-closed behavior

## Remaining Visual Risks

- Presentation mode hides sensitive UI by selector. New future user/admin widgets should be marked with `data-sensitive` when they should not appear in investor/demo screenshots.
- Motion polish is intentionally broad but conservative. Page-specific microinteractions can be further tuned after beta users react to the new feel.
- Current screenshots can still be interrupted by the legal risk acknowledgement modal on fresh sessions; this is expected and should not be bypassed for real users.

## Verdict

Local and production validation passed. The motion/polish layer is deployed from Git source of truth and production route/performance checks remain within budget.

Final status: `INSTITUTIONAL MOTION VISUAL POLISH COMPLETE`
