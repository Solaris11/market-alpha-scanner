# Phase 13.2c - Public Auth Route UX Hardening

Date: 2026-05-12

## Summary

Public `/register` and `/login` routes no longer return 404. They now render intentional closed-beta auth entry pages that reuse the existing TradeVeto auth modal and signup/login forms.

Final status: `PUBLIC AUTH ROUTE HARDENING COMPLETE`

## Old Broken Behavior

- `/register` returned 404.
- `/login` returned 404.
- External CTA traffic from Facebook, X/Twitter, Discord, Reddit, direct invite links, or shared beta links could land on an unfinished route.
- This created unnecessary trust loss before the user even reached the invite-code flow.

## New Onboarding Flow

### `/register`

- Renders a closed-beta signup wrapper.
- Auto-opens the existing registration modal.
- Clearly states invite-only access, research-only positioning, and controlled beta limits.
- Supports shared invite links through `/register?invite=...` or `/register?inviteCode=...`.
- Prefills the invite code into the existing registration form.
- After successful registration/session refresh, redirects the user to `/terminal`.

### `/login`

- Renders a closed-beta sign-in wrapper.
- Auto-opens the existing login modal.
- Supports existing beta users without exposing a raw route error.
- If the user is already authenticated, redirects to `/terminal`.

## Route Architecture

- Added `frontend/src/app/register/page.tsx`.
- Added `frontend/src/app/login/page.tsx`.
- Added reusable client wrapper `frontend/src/components/account/PublicAuthRoute.tsx`.
- Reused the existing `AuthModal`, `LoginForm`, and `RegisterForm`; no duplicate auth system was introduced.
- Extended `RegisterForm` and `AuthModal` with optional `initialInviteCode` support.

## Redirect / Modal Logic

- Public auth pages render valid HTML first, then open the auth modal client-side.
- Closing the modal leaves the user on an intentional page with clear beta messaging and a button to reopen auth.
- Successful auth refresh triggers a client redirect to `/terminal`.
- No infinite redirect behavior was observed in local route checks.

## Invite-Only Messaging

The new pages explicitly communicate:

- Closed beta access.
- Invite code required for new accounts.
- Existing users can sign in.
- Research-only platform.
- No financial advice or broker execution.

## Mobile Behavior

The auth modal was hardened for mobile viewport width:

- Modal width is constrained with `maxWidth: min(28rem, calc(100vw - 4rem))`.
- Overlay padding is reduced on small screens.
- Mobile screenshots were captured through Chrome DevTools Protocol device emulation at `390x844`.
- The final mobile screenshots no longer show the modal clipped horizontally.

## Facebook CTA Compatibility

Recommended Facebook CTA flow now works:

`Facebook Sign Up CTA -> /register -> auth modal -> invite code signup -> /terminal`

The routes also return canonical and OpenGraph metadata, so social/in-app browsers receive a valid public HTML page instead of a 404.

## SEO / Crawler Safety

- `/register` and `/login` return valid HTML.
- Both routes include canonical metadata.
- Both routes include OpenGraph and Twitter preview metadata.
- Both routes are marked `noindex, follow` to avoid index clutter while preserving valid crawler behavior.

## Screenshots

- Desktop register: `docs/ops/artifacts/phase-13-public-auth-route-hardening/register-desktop.png`
- Mobile register: `docs/ops/artifacts/phase-13-public-auth-route-hardening/register-mobile.png`
- Desktop login: `docs/ops/artifacts/phase-13-public-auth-route-hardening/login-desktop.png`
- Mobile login: `docs/ops/artifacts/phase-13-public-auth-route-hardening/login-mobile.png`

## Validation Results

Local validation:

- `npm run lint` - passed
- `npm test -- --runInBand` - passed, 371 tests
- `npm run build` - passed; `/register` and `/login` appear in the App Router route table
- `npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings
- `git diff --check` - passed

Local route validation:

- `/register` - HTTP 200
- `/login` - HTTP 200
- `/register` canonical metadata - present
- `/login` canonical metadata - present
- `/register` social preview metadata - present
- `/login` social preview metadata - present
- Local route parity check - passed
- Local performance budget check - passed

## Remaining Risks

- Full valid-invite registration and existing-user login must be verified again in production with real production beta env values after deployment.
- Facebook in-app browser behavior was covered by mobile viewport and social metadata checks, but should still be verified manually from the actual Facebook CTA surface after deploy.
