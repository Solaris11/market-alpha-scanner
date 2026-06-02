# Phase 34.2 Mobile Certification Evidence Archive

Target: `https://tradeveto.com`

This archive is for real-device mobile evidence only. Acceptable evidence:

- BrowserStack Live/manual screenshots, videos, session URLs, device metadata, and reviewer notes.
- Physical iPhone/iPad/Android screenshots or videos with device/browser metadata.
- Physical Facebook/Instagram in-app browser screenshots or videos with device metadata.

Not accepted as final certification evidence:

- BrowserStack Automate failures or partial startup attempts.
- Desktop responsive screenshots.
- Playwright/Chromium mobile emulation.
- Route HTTP smoke without real-device screenshots.
- Pass/fail tables without reviewer notes and visual evidence.

## Required Devices

- `iphone-safari/`
- `android-chrome/`
- `ipad-safari/`
- `facebook-in-app/`
- `instagram-in-app/`

Each device folder should contain:

- screenshots for every required route
- optional video recording
- `notes.md`
- `pass-fail-table.md`
- BrowserStack Live session URL if available

## Required Routes

- `/`
- `/discover`
- `/scanner`
- `/symbol/AMD`
- `/terminal`
- `/feed`
- `/history`
- `/performance`
- `/alerts`
- `/account`

## Evidence Naming

Use these names:

- `home.png`
- `discover.png`
- `scanner.png`
- `symbol-amd.png`
- `terminal.png`
- `feed.png`
- `history.png`
- `performance.png`
- `alerts.png`
- `account.png`
- `recording.mp4` if available

Do not store secrets, cookies, payment data, private account information, or personal emails in screenshots/videos.
