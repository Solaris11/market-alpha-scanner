# Phase 21.2 Mobile Safe-Area + Overlay Fixes

Date: 2026-05-23
Production target: https://tradeveto.com
Code commit deployed: `e65e6a0`

## Verdict

Implementation and production smoke evidence passed. BrowserStack real-device certification did not pass because BrowserStack rejected both real-device sessions with `Automate testing time expired`.

Final certification status: NOT ACCOMPLISHED until BrowserStack Automate time is restored and the iPhone Safari plus Android Chrome device run completes.

## Fixed Surfaces

- Risk acknowledgement overlay: moved to a body portal, added mobile viewport CSS vars, locked background scroll, and placed CTA actions in a governed sticky/safe footer.
- Notifications overlay: moved mobile mode to a fixed safe-area panel above bottom navigation, added internal scroll governance, removed notification body truncation, and preserved sticky header behavior.
- Account onboarding gate: body portal, viewport vars, scroll lock, safe footer, and full-width mobile CTA.
- Auth modal: dynamic viewport max height and critical overlay root handling.
- Execution confirmation modal: body portal, scroll lock, viewport vars, and safe footer spacing.
- Stable detail overlays and discovery overlays: shared safe-area viewport sizing and bottom clearance.
- Mobile nav and gesture layer: centralized mobile nav clearance using `--tv-mobile-nav-clearance`.

## Safe-Area Governance

Added global CSS variables and classes in `frontend/src/app/globals.css`:

- `--tv-safe-area-top`
- `--tv-safe-area-bottom`
- `--tv-mobile-nav-height`
- `--tv-mobile-nav-clearance`
- `--tv-overlay-top-gap`
- `--tv-overlay-bottom-gap`
- `--tv-mobile-overlay-available-height`
- `--tv-mobile-nav-overlay-available-height`
- `.tv-critical-overlay-root`
- `.tv-critical-overlay-panel`
- `.tv-critical-overlay-scroll`
- `.tv-critical-overlay-footer`
- `.tv-notification-menu`
- `.tv-notification-scroll`

These rules reserve browser safe areas, dynamic visual viewport height, keyboard offset, and bottom nav clearance before sizing mobile overlay panels.

## Screenshot Artifacts

Before evidence came from the reported production real-mobile screenshots.

After artifacts:

- `docs/ops/artifacts/phase-21-2/local-risk-ack-after.png`
- `docs/ops/artifacts/phase-21-2/local-notifications-after.png`
- `docs/ops/artifacts/phase-21-2/production-risk-ack-after.png`
- `docs/ops/artifacts/phase-21-2/production-notifications-after.png`
- `docs/ops/artifacts/phase-21-2/production-mobile-overlay-geometry.json`
- `docs/ops/artifacts/phase-21-2/browserstack-real-device.log`

## Local Validation

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 474 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |

## Production Deploy Proof

Production host: `sre@100.68.155.121`
Production path: `/opt/apps/market-alpha-scanner/app`

Deployment actions completed:

- `git pull --ff-only origin main`
- `npm --prefix frontend ci --legacy-peer-deps`
- `docker compose --env-file .env up -d --build market-alpha-frontend`

Production container proof:

```text
commit e65e6a0
market-alpha-frontend   Up 5 minutes (healthy)   3001/tcp
```

## Production Smoke

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.186369s |
| `/api/health/deep` | 200 | 0.131884s |
| `/terminal` | 200 | 0.228394s |
| `/paper` | 200 | 0.190000s |
| `/discover` | 200 | 0.108130s |
| `/scanner` | 200 | 0.256731s |
| `/symbol/AMD` | 200 | 0.315387s |

## Production Overlay Geometry

Captured against `https://tradeveto.com` using an iPhone 14 Pro mobile viewport in local Chrome after the production rebuild.

Risk acknowledgement:

- Viewport: 393 x 660
- Continue CTA: top 513, bottom 557, height 44
- Mobile nav: top 572, bottom 648
- CTA clearance above nav: 15px
- Horizontal overflow: 0
- Continue tap dismissed overlay: true

Notifications:

- Viewport: 393 x 660
- Notification menu: top 12, bottom 560
- Mobile nav: top 572, bottom 648
- Menu clearance above nav: 12px
- Cards rendered: 8
- Scroll client height: 480
- Scroll height: 1225
- Horizontal overflow: 0

## BrowserStack Real-Device Attempt

Command executed on production:

```bash
TRADEVETO_MOBILE_UX_BASE_URL=https://tradeveto.com npm --prefix frontend run test:phase21:mobile-real-device
```

BrowserStack build URL:

- https://automation.browserstack.com/builds/k9kzvr6qjvuyxn7pfpfnwthsmyju2epczckn6fpd

Device matrix attempted:

| Device / Browser | Result |
| --- | --- |
| iPhone 15 Pro Max / Safari | Failed before session: `Automate testing time expired.` |
| Samsung Galaxy S23 Ultra / Chrome | Failed before session: `Automate testing time expired.` |

Session URLs were not produced because BrowserStack rejected connection before either real-device browser session started.

## Remaining Blockers

- BrowserStack Automate account time must be restored.
- Re-run `npm --prefix frontend run test:phase21:mobile-real-device` on production after time is restored.
- Capture successful iPhone Safari and Android Chrome session URLs, videos, screenshots, and route matrix results.
- Physical iPhone/Android proof remains outside this run.
