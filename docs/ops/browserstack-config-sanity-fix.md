# BrowserStack Config Sanity Fix

Date: 2026-05-24

## Scope

This was a BrowserStack Automate configuration sanity pass, not a full mobile route matrix or mobile certification.

Target URL:

- `https://tradeveto.com`

Smoke assertion:

- page opens
- `body` is visible
- no overlays
- no screenshots
- no route matrix

Official BrowserStack Playwright capability references used:

- `https://www.browserstack.com/docs/automate/playwright/playwright-capabilities`
- `https://www.browserstack.com/docs/automate/playwright/browsers-and-os`

## Audit Summary

| Area | Finding | Action |
| --- | --- | --- |
| `browserstack.yml` | Included iPad, heavier logs/video/debug, and old phase build name. | Reduced to one desktop Chrome, one Android Chrome, one iPhone Safari. |
| BrowserStack Local | `browserstackLocal` was already `false`. `tradeveto.com` is public, so Local is not required. | Kept disabled. |
| Playwright minimal config | Existing minimal direct-CDP diagnostic had long timeouts but defaulted to the previous timeout artifact path. | Repointed to this sanity-fix artifact path. |
| BrowserStack SDK integration | Existing full scripts still use `browserstack-node-sdk`; previous untracked SDK logs showed unauthorized/setup failures. | Added direct-CDP minimal scripts that do not use the SDK wrapper; legacy SDK scripts now load project `.env` before execution. |
| Environment loading | Local shell and repo env files do not expose BrowserStack credentials. Production project `.env` contains both keys. | BrowserStack scripts now source `../.env` when present before running Playwright. |

## Simplified `browserstack.yml`

The SDK YAML now contains only:

- Desktop Chrome: Windows 11, Chrome latest
- Android Chrome: Samsung Galaxy S23, Chrome
- iPhone Safari: iPhone 15, Safari
- `browserstackLocal: false`

Removed:

- iPad
- iPhone Pro Max / Ultra device variants
- extra debug settings
- network logs
- video flag
- self-heal flag
- per-platform Playwright naming overrides

## Minimal Playwright Smoke

Added/updated:

- `frontend/playwright.browserstack-minimal.config.ts`
- `frontend/tests/browserstack-minimal/minimal-automate-smoke.spec.ts`
- `npm --prefix frontend run test:browserstack:minimal`
- `npm --prefix frontend run test:browserstack:minimal:desktop`
- `npm --prefix frontend run test:browserstack:minimal:android`
- `npm --prefix frontend run test:browserstack:minimal:iphone`

Updated legacy SDK scripts to source `../.env` before invoking `browserstack-node-sdk`:

- `npm --prefix frontend run test:browserstack`
- `npm --prefix frontend run test:browserstack:mobile`
- `npm --prefix frontend run test:phase22:mobile-real-device`
- `npm --prefix frontend run test:phase22:chart-real-device`

The minimal smoke uses:

- direct Playwright CDP connection to BrowserStack
- test timeout: 5 minutes
- expect timeout: 30 seconds
- connect timeout: 240 seconds
- navigation timeout: 240 seconds
- retries: 1
- workers: 1
- screenshots/video/trace disabled
- BrowserStack debug/network logs disabled

## Environment Verification

No secret values were printed.

| Location | `BROWSERSTACK_USERNAME` | `BROWSERSTACK_ACCESS_KEY` | Notes |
| --- | --- | --- | --- |
| Local shell | missing | missing | `process.env` does not contain either variable. |
| Local repo `.env` | missing | missing | No local root/frontend env file with these keys was found. |
| Production login shell | missing | missing | SSH login shell does not export either variable. |
| Production project `.env` | present | present | `/opt/apps/market-alpha-scanner/app/.env` contains both keys. |

Because the required variables are missing locally, local BrowserStack Automate cannot create sessions.

## Run Results

Commands were run in the requested order.

| Order | Command | Build created | Session count > 0 | Startup time before failure | Dashboard URL | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `npm --prefix frontend run test:browserstack:minimal:desktop` | No | No | 0 ms | none, no session created | Failed before BrowserStack connection |
| 2 | `npm --prefix frontend run test:browserstack:minimal:android` | No | No | 0 ms | none, no session created | Failed before BrowserStack connection |
| 3 | `npm --prefix frontend run test:browserstack:minimal:iphone` | No | No | 0 ms | none, no session created | Failed before BrowserStack connection |

Exact failure for all three:

```text
BrowserStack credentials missing from environment: BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY
```

Retry #1 produced the same pre-session failure for all three targets.

## Artifact Inventory

Generated artifacts:

- `docs/ops/artifacts/browserstack-config-sanity-fix/desktop-smoke.log`
- `docs/ops/artifacts/browserstack-config-sanity-fix/android-smoke.log`
- `docs/ops/artifacts/browserstack-config-sanity-fix/iphone-smoke.log`
- `docs/ops/artifacts/browserstack-config-sanity-fix/browserstack-minimal-playwright-report.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/01-desktop-chrome-retry-0.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/01-desktop-chrome-retry-1.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/02-android-chrome-retry-0.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/02-android-chrome-retry-1.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/03-iphone-safari-retry-0.json`
- `docs/ops/artifacts/browserstack-config-sanity-fix/session-attempts/03-iphone-safari-retry-1.json`

The attempt JSON files intentionally omit BrowserStack secret values.

## Validation

| Check | Result |
| --- | --- |
| `node -e 'JSON.parse(...)'` for `frontend/package.json` | Pass |
| `npm --prefix frontend run lint` | Pass |
| `git diff --check` | Pass |
| Desktop BrowserStack smoke | Failed before session creation |
| Android BrowserStack smoke | Failed before session creation |
| iPhone BrowserStack smoke | Failed before session creation |

## Verdict

Configuration was simplified, but the sanity fix did not pass because local BrowserStack credentials are not available, so no build or session could be created.
