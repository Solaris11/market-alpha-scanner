# BrowserStack Live Manual Real-Device POC

Date: 2026-05-23

Target URL: `https://tradeveto.com`

POC status: `READY FOR MANUAL EVIDENCE CAPTURE`

This POC defines a manual real-device evidence process for BrowserStack Live. It does not use BrowserStack Automate and does not claim automated certification.

## Why Automate Is Not Used

Current BrowserStack access appears to support Desktop and Mobile Live manual testing, while Automate sessions fail before route execution with:

```text
Automate testing time expired
```

For this POC, do not run:

- `browserstack-node-sdk`
- Playwright BrowserStack Automate
- `npx browserstack-node-sdk`
- automated BrowserStack sessions

This proof model uses BrowserStack Live/manual evidence or physical-device evidence only.

## Certification Boundary

This is not full Phase 23 mobile certification.

This POC only proves that manual real-device evidence can be collected, organized, reviewed, and used as a future Phase 23.1 certification input.

Allowed evidence sources:

- BrowserStack Live manual sessions
- Physical iPhone/iPad/Android screenshots or videos
- Optional Facebook in-app browser physical capture
- Optional Instagram in-app browser physical capture

Not allowed as certification evidence for this POC:

- Desktop screenshots
- Emulator-only screenshots
- BrowserStack Automate output
- Playwright BrowserStack Automate reports
- Claims without screenshot/video/session proof

## Device And Browser Matrix

| Device/browser target | Evidence source | Required for POC | Status | Session URL | Notes |
| --- | --- | --- | --- | --- | --- |
| iPhone Safari | BrowserStack Live or physical iPhone | Yes | Pending manual capture | Pending | Use the newest available iPhone Safari device. |
| Android Chrome | BrowserStack Live or physical Android | Yes | Pending manual capture | Pending | Use a modern Samsung Galaxy or Pixel if available. |
| iPad Safari | BrowserStack Live or physical iPad | If available | Pending manual capture | Pending | Record unavailable if BrowserStack Live subscription does not expose iPad. |
| Facebook in-app browser | Physical device | Optional | Pending manual capture | Not applicable | Capture only if a physical account/device workflow is available. |
| Instagram in-app browser | Physical device | Optional | Pending manual capture | Not applicable | Capture only if a physical account/device workflow is available. |

## POC Routes

Only these production routes are in scope:

| Route | URL |
| --- | --- |
| Terminal | `https://tradeveto.com/terminal` |
| Macro | `https://tradeveto.com/macro` |
| Paper | `https://tradeveto.com/paper` |
| AMD symbol chart | `https://tradeveto.com/symbol/AMD` |

## Manual Route Checklist

Run this checklist for each device/browser and each route.

| Check | Pass criteria |
| --- | --- |
| Page loads successfully | Route reaches a usable TradeVeto page without a fatal error. |
| No obvious clipped content | Primary content and controls are visible within the viewport. |
| No horizontal overflow | Page does not pan sideways and no content forces horizontal scroll. |
| Bottom nav safety | Bottom nav does not cover important buttons, CTAs, inputs, or sheet controls. |
| Risk acknowledgment CTA | If shown, checkbox and continue CTA are visible and tappable. |
| Notification overlay | Overlay opens, scrolls if needed, and notification cards are not clipped. |
| `/paper` overlay deep scroll | Open an overlay after deep scroll, close it, and confirm scroll position is not lost. |
| `/macro` overlay stability | Open macro overlay/detail content and confirm it does not jump or hide content. |
| `/symbol/AMD` chart/fullscreen | If fullscreen is available, open/close it and confirm chart controls remain visible. |

## Evidence Capture Instructions

For each device/browser:

1. Open BrowserStack Live or the physical device browser.
2. Navigate to each POC route on `https://tradeveto.com`.
3. Capture one screenshot per route.
4. Capture a short screen recording if BrowserStack Live or the physical device supports it.
5. Copy the BrowserStack Live session URL if Live exposes one.
6. Record device name, OS version, browser name/version, and pass/fail notes.
7. Store evidence under:

```text
docs/ops/artifacts/browserstack-live-manual-poc/
```

Recommended naming:

```text
docs/ops/artifacts/browserstack-live-manual-poc/
  iphone-safari/
    terminal.png
    macro.png
    paper.png
    symbol-amd.png
    recording.mp4
    notes.md
  android-chrome/
    terminal.png
    macro.png
    paper.png
    symbol-amd.png
    recording.mp4
    notes.md
  ipad-safari/
    terminal.png
    macro.png
    paper.png
    symbol-amd.png
    recording.mp4
    notes.md
```

If a device is unavailable, add a `notes.md` file for that device explaining why.

## Manual Pass/Fail Table

Fill this table after manual capture.

| Device | OS | Browser | Route | Load | No clipped content | No horizontal overflow | Bottom nav safe | Risk CTA safe | Notification overlay safe | Route-specific overlay/chart | Screenshot | Video | Session URL | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone | Pending | Safari | `/terminal` | Pending | Pending | Pending | Pending | Pending | Pending | n/a | Pending | Pending | Pending | Pending | Pending |
| iPhone | Pending | Safari | `/macro` | Pending | Pending | Pending | Pending | Pending | Pending | Pending macro overlay | Pending | Pending | Pending | Pending | Pending |
| iPhone | Pending | Safari | `/paper` | Pending | Pending | Pending | Pending | Pending | Pending | Pending deep-scroll overlay | Pending | Pending | Pending | Pending | Pending |
| iPhone | Pending | Safari | `/symbol/AMD` | Pending | Pending | Pending | Pending | Pending | Pending | Pending chart/fullscreen | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Chrome | `/terminal` | Pending | Pending | Pending | Pending | Pending | Pending | n/a | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Chrome | `/macro` | Pending | Pending | Pending | Pending | Pending | Pending | Pending macro overlay | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Chrome | `/paper` | Pending | Pending | Pending | Pending | Pending | Pending | Pending deep-scroll overlay | Pending | Pending | Pending | Pending | Pending |
| Android | Pending | Chrome | `/symbol/AMD` | Pending | Pending | Pending | Pending | Pending | Pending | Pending chart/fullscreen | Pending | Pending | Pending | Pending | Pending |
| iPad | Pending | Safari | `/terminal` | Pending | Pending | Pending | Pending | Pending | Pending | n/a | Pending | Pending | Pending | Pending | Pending |
| iPad | Pending | Safari | `/macro` | Pending | Pending | Pending | Pending | Pending | Pending | Pending macro overlay | Pending | Pending | Pending | Pending | Pending |
| iPad | Pending | Safari | `/paper` | Pending | Pending | Pending | Pending | Pending | Pending | Pending deep-scroll overlay | Pending | Pending | Pending | Pending | Pending |
| iPad | Pending | Safari | `/symbol/AMD` | Pending | Pending | Pending | Pending | Pending | Pending | Pending chart/fullscreen | Pending | Pending | Pending | Pending | Pending |

## Screenshot And Video Artifact Locations

Evidence should be stored here:

```text
docs/ops/artifacts/browserstack-live-manual-poc/
```

Placeholder folder file:

```text
docs/ops/artifacts/browserstack-live-manual-poc/README.md
```

Future evidence files should not include secrets, cookies, account identifiers, email addresses, payment details, or private user data.

## POC Acceptance Criteria

This POC is ready when:

- The manual plan is documented.
- The route checklist is documented.
- The device matrix is documented.
- The artifact folder exists in the repo.
- The process explicitly avoids BrowserStack Automate.
- The process does not claim full mobile certification before manual evidence is captured.

This POC becomes evidence-complete only when at least iPhone Safari and Android Chrome have screenshots for all four POC routes and pass/fail notes are filled in.

## Remaining Gaps

- No manual BrowserStack Live screenshots are captured yet.
- No manual BrowserStack Live videos are captured yet.
- No BrowserStack Live session URLs are captured yet.
- No physical iPhone/iPad/Android proof is captured yet.
- No Facebook or Instagram in-app browser proof is captured yet.
- This process covers only four routes, not the full Phase 23.1 mobile route matrix.
- This process does not replace automated regression testing.

## Recommendation For Phase 23.1

Use BrowserStack Live/manual certification as the immediate real-device proof path while Automate access remains unavailable.

Recommended Phase 23.1 approach:

1. Keep Automate out of the critical path until BrowserStack account access explicitly includes Automate minutes.
2. Use BrowserStack Live for iPhone Safari, Android Chrome, and iPad Safari evidence capture.
3. Use physical devices for Facebook and Instagram in-app browser proof.
4. Store screenshots, videos, session URLs, device metadata, and pass/fail notes under phase-specific artifact folders.
5. Treat BrowserStack Live/manual evidence as valid proof only when every required route/device row includes screenshot or video evidence and reviewer notes.
6. Keep final Phase 23.1 certification separate from this POC and require the broader route matrix before marking mobile certification accomplished.

## POC Verdict

BROWSERSTACK LIVE MANUAL POC READY
