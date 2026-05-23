# Phase 23.1 - Real-Device + BrowserStack Live Mobile Certification

Date: 2026-05-23

Production target: `https://tradeveto.com`

Certification result: `TRADEVETO REAL-DEVICE + BROWSERSTACK LIVE MOBILE CERTIFICATION NOT ACCOMPLISHED`

## Certification Boundary

This phase must use manual real-device evidence only:

- BrowserStack Live manual sessions
- Physical iPhone/iPad/Android screenshots or videos
- Physical Facebook and Instagram in-app browser screenshots or videos

Do not use:

- `browserstack-node-sdk`
- `npx browserstack-node-sdk`
- Playwright BrowserStack Automate
- automated BrowserStack sessions

BrowserStack Automate is intentionally out of scope because prior runs failed with:

```text
Automate testing time expired
```

## Current Production State

Production checkout and container:

| Check | Result |
| --- | --- |
| Production commit | `1752a7b` |
| Frontend container | `market-alpha-frontend Up 2 minutes (healthy)` |
| Frontend image | `market-alpha-scanner-market-alpha-frontend` |

Production health smoke:

| Check | Result |
| --- | --- |
| `/api/health` | 200, `ok: true`, service `tradeveto-frontend` |
| `/api/health/deep` | 200, DB ok, scanner ok, backup ok |

Production route smoke:

| Route | HTTP |
| --- | ---: |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/paper` | 200 |
| `/macro` | 200 |
| `/symbol/AMD` | 200 |
| `/alerts` | 200 |
| `/feed` | 200 |
| `/market-memory` | 200 |

## Local Validation

Required repo validation passed after creating the documentation and manual evidence templates:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 491 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |

## Required Device Matrix

| Device/browser | Required status | Evidence status | Certification status |
| --- | --- | --- | --- |
| iPhone Safari | Required | Missing | Blocked |
| Android Chrome | Required | Missing | Blocked |
| iPad Safari | Strongly preferred | Missing | Not yet proven |
| Facebook in-app browser | Manual physical/in-app | Missing | Not yet proven |
| Instagram in-app browser | Manual physical/in-app | Missing | Not yet proven |

## Required Route Matrix

Each required device/browser must capture evidence for:

| Route | Required evidence |
| --- | --- |
| `/terminal` | Screenshot; optional video |
| `/discover` | Screenshot; optional video |
| `/scanner` | Screenshot; optional video |
| `/paper` | Screenshot; optional video; deep-scroll overlay notes |
| `/macro` | Screenshot; optional video; overlay notes |
| `/symbol/AMD` | Screenshot; optional video; chart/fullscreen notes |
| `/alerts` | Screenshot; optional video |
| `/feed` | Screenshot; optional video |
| `/market-memory` | Screenshot; optional video |

## Manual Checklist

For every route/device row, validate:

| Check | Pass criteria |
| --- | --- |
| Page loads successfully | Route renders a usable TradeVeto surface. |
| No fatal error | No fatal application error, blank screen, or blocking runtime crash. |
| No horizontal overflow | Page does not pan sideways and no fixed element extends beyond the viewport. |
| No clipped critical content | Primary cards, buttons, overlays, and messages are readable. |
| Bottom nav does not cover CTAs/buttons | Bottom navigation does not obstruct actionable controls. |
| Risk acknowledgment CTA | If shown, checkbox and Continue CTA are visible and tappable. |
| Notification overlay | Bell opens drawer; cards are not clipped; close/X, bell toggle, outside click, and Escape where available dismiss it. |
| `/paper` overlay deep scroll | Deep-scroll overlay open/close preserves page position. |
| `/macro` overlay | Overlay/detail content does not jump or hide content. |
| `/symbol/AMD` chart fullscreen | Chart/fullscreen opens and closes safely if available. |
| Scanner touch controls | Scanner controls can be used by touch. |
| Sticky/fixed safety | Sticky/fixed elements do not block content. |
| Keyboard safety | Keyboard does not cover critical inputs. |
| Touch-safe feel | Page feels tappable, stable, and production-safe. |

## Evidence Folder

Evidence must be stored under:

```text
docs/ops/artifacts/phase-23-1-mobile-certification/
```

Tracked template folders:

```text
iphone-safari/
android-chrome/
ipad-safari/
facebook-in-app/
instagram-in-app/
```

Each folder contains:

- `notes.md`
- `pass-fail-table.md`

Future evidence files should use route names:

```text
terminal.png
discover.png
scanner.png
paper.png
macro.png
symbol-amd.png
alerts.png
feed.png
market-memory.png
recording.mp4
```

If BrowserStack Live exposes a session URL, add it to the device `notes.md`.

## Evidence Inventory

| Device/browser | Screenshots | Video | BrowserStack Live session URL | Notes | Pass/fail table |
| --- | --- | --- | --- | --- | --- |
| iPhone Safari | Missing | Missing | Missing | `docs/ops/artifacts/phase-23-1-mobile-certification/iphone-safari/notes.md` | `docs/ops/artifacts/phase-23-1-mobile-certification/iphone-safari/pass-fail-table.md` |
| Android Chrome | Missing | Missing | Missing | `docs/ops/artifacts/phase-23-1-mobile-certification/android-chrome/notes.md` | `docs/ops/artifacts/phase-23-1-mobile-certification/android-chrome/pass-fail-table.md` |
| iPad Safari | Missing | Missing | Missing | `docs/ops/artifacts/phase-23-1-mobile-certification/ipad-safari/notes.md` | `docs/ops/artifacts/phase-23-1-mobile-certification/ipad-safari/pass-fail-table.md` |
| Facebook in-app browser | Missing | Missing | Not applicable | `docs/ops/artifacts/phase-23-1-mobile-certification/facebook-in-app/notes.md` | `docs/ops/artifacts/phase-23-1-mobile-certification/facebook-in-app/pass-fail-table.md` |
| Instagram in-app browser | Missing | Missing | Not applicable | `docs/ops/artifacts/phase-23-1-mobile-certification/instagram-in-app/notes.md` | `docs/ops/artifacts/phase-23-1-mobile-certification/instagram-in-app/pass-fail-table.md` |

## Physical And In-App Evidence Notes

No physical iPhone, iPad, Android, Facebook in-app, or Instagram in-app evidence files are present for this phase yet.

When evidence is added, do not include:

- secrets
- cookies
- session tokens
- private account information
- payment information
- personal emails

## Pass/Fail Result

| Requirement | Result |
| --- | --- |
| iPhone Safari evidence passes | Fail - evidence missing |
| Android Chrome evidence passes | Fail - evidence missing |
| Screenshots/videos exist for all required routes | Fail - evidence missing |
| Pass/fail notes complete | Fail - pending |
| No critical mobile blocker remains | Unknown - real-device evidence missing |

## Remaining Blockers

- iPhone Safari screenshots/videos for all required routes are missing.
- Android Chrome screenshots/videos for all required routes are missing.
- iPhone Safari pass/fail table is not complete.
- Android Chrome pass/fail table is not complete.
- iPad Safari proof is missing.
- Facebook in-app browser proof is missing.
- Instagram in-app browser proof is missing.
- BrowserStack Live session URLs are missing.
- No manual real-device reviewer notes are available yet.

## Certification Verdict

TRADEVETO REAL-DEVICE + BROWSERSTACK LIVE MOBILE CERTIFICATION NOT ACCOMPLISHED
