# Phase 28.6 - Real-Device Mobile Certification Closure

Date: 2026-05-28
Target: `https://tradeveto.com`
Status: Not accomplished.

## Certification Boundary

This phase requires real-device evidence. Acceptable sources:

- BrowserStack Live/manual real-device sessions.
- Physical iPhone screenshots/videos.
- Physical Android screenshots/videos.
- Optional physical iPad screenshots/videos.
- Optional Facebook and Instagram in-app browser screenshots/videos.

Not accepted:

- BrowserStack Automate unless entitlement is confirmed working.
- Emulator-only screenshots.
- Desktop responsive screenshots.
- Playwright mobile emulation.
- Claims without screenshot, video, session URL, and reviewer notes.

## Production Smoke

Production smoke completed from `/opt/apps/market-alpha-scanner/app`.

Production commit: `40e3498`.

BrowserStack environment variables on production:

- `BROWSERSTACK_USERNAME`: present.
- `BROWSERSTACK_ACCESS_KEY`: present.

| Check | Result |
| --- | --- |
| `/api/health` | Pass |
| `/api/health/deep` | Pass |
| `/terminal` | HTTP 200 |
| `/discover` | HTTP 200 |
| `/scanner` | HTTP 200 |
| `/paper` | HTTP 200 |
| `/macro` | HTTP 200 |
| `/symbol/AMD` | HTTP 200 |
| `/alerts` | HTTP 200 |
| `/feed` | HTTP 200 |
| `/market-memory` | HTTP 200 |

Smoke artifact:

- `docs/ops/artifacts/phase-28-6-mobile/production-smoke.txt`

## Device Matrix

| Device/browser | Required | Evidence source | Evidence status | Certification status |
| --- | --- | --- | --- | --- |
| iPhone Safari | Yes | BrowserStack Live/manual or physical iPhone | Missing screenshots, video/session URL, metadata, and notes | Blocked |
| Android Chrome | Yes | BrowserStack Live/manual or physical Android | Missing screenshots, video/session URL, metadata, and notes | Blocked |
| iPad Safari | If available | BrowserStack Live/manual or physical iPad | Missing | Not proven |
| Physical iPhone | Required if available | Physical device | Missing | Blocked |
| Physical Android | Required if available | Physical device | Missing | Blocked |
| Facebook in-app browser | If available | Physical device | Missing | Not proven |
| Instagram in-app browser | If available | Physical device | Missing | Not proven |

## Required Route Matrix

Each required device/browser must capture evidence for:

| Route | Required checks |
| --- | --- |
| `/terminal` | Page load, no fatal error, no horizontal overflow, bottom nav safe, notification drawer safe, keyboard/back behavior safe |
| `/discover` | Discovery controls touch-safe, no clipped content, no horizontal overflow |
| `/scanner` | Scanner controls usable, filters/sort touch-safe, bottom nav not covering controls |
| `/paper` | Overlay deep-scroll open/close preserves position, no clipped CTA |
| `/macro` | Overlay opens/closes without content jump or hidden controls |
| `/symbol/AMD` | Chart fullscreen opens/closes safely, toolbar not clipped |
| `/alerts` | Alert controls usable, keyboard does not cover critical inputs |
| `/feed` | Feed cards readable, notification drawer safe |
| `/market-memory` | Memory cards readable, overlays/scroll safe |

## Evidence Inventory

Evidence folder:

- `docs/ops/artifacts/phase-28-6-mobile/`

Current inventory:

| Device/browser | Notes | Pass/fail table | Screenshots | Video | Session URL | Result |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone Safari | Present template | Present template | Missing | Missing | Missing | Blocked |
| Android Chrome | Present template | Present template | Missing | Missing | Missing | Blocked |
| iPad Safari | Present template | Present template | Missing | Missing | Missing | Not proven |
| Physical iPhone | Present template | Present template | Missing | Missing | Not applicable | Blocked |
| Physical Android | Present template | Present template | Missing | Missing | Not applicable | Blocked |
| Facebook in-app browser | Present template | Present template | Missing | Missing | Not applicable | Not proven |
| Instagram in-app browser | Present template | Present template | Missing | Missing | Not applicable | Not proven |

## Manual Capture Instructions

For each BrowserStack Live/manual device:

1. Open BrowserStack Live.
2. Select a real device:
   - iPhone Safari.
   - Android Chrome.
   - iPad Safari if available.
3. Navigate to each required route on `https://tradeveto.com`.
4. Capture a screenshot for each route.
5. Capture a video if BrowserStack Live exposes recording.
6. Copy BrowserStack Live session URL if available.
7. Fill `notes.md` with device, OS, browser version, session URL, and reviewer notes.
8. Fill `pass-fail-table.md`.
9. Store screenshots using route names:
   - `terminal.png`
   - `discover.png`
   - `scanner.png`
   - `paper.png`
   - `macro.png`
   - `symbol-amd.png`
   - `alerts.png`
   - `feed.png`
   - `market-memory.png`

For physical devices, capture device screenshots/video and fill the same notes/pass-fail files. Do not include secrets, cookies, private account data, payment data, or personal emails.

## Findings

No real-device screenshots, videos, BrowserStack Live session URLs, OS/browser metadata, or reviewer notes are available in the workspace for Phase 28.6.

No code-level mobile blocker can be verified or fixed from missing evidence alone. Production smoke is green, but smoke does not satisfy real-device certification.

## Remaining Blockers

- iPhone Safari real-device evidence is missing.
- Android Chrome real-device evidence is missing.
- Required screenshots for all nine routes are missing.
- Video or BrowserStack Live session URLs are missing.
- Physical iPhone and Android proof is missing.
- Facebook and Instagram in-app browser proof is missing.
- Pass/fail tables are templates only and cannot be completed without evidence.

## Verdict

TRADEVETO REAL-DEVICE MOBILE CERTIFICATION CLOSURE NOT ACCOMPLISHED
