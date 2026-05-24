# BrowserStack Minimal Automate Timeout Diagnostic

Date: 2026-05-24

## Scope

This was a minimal BrowserStack Automate smoke from the production Linux host, not a full mobile route matrix or mobile certification.

Target URL:

- `https://tradeveto.com`

Smoke assertion:

- open the home page
- assert `body` is visible

No overlays, screenshots, or route matrix were included.

## Production Setup

Host:

- `sre@100.68.155.121`

Path:

- `/opt/apps/market-alpha-scanner/app`

Production code was updated before the run:

```text
git pull --ff-only origin main
0fce36b..85f8f4e
```

BrowserStack credentials were verified from production `.env` without printing secret values:

```text
BROWSERSTACK_USERNAME=***present***
BROWSERSTACK_ACCESS_KEY=***present***
```

The test was run after:

```bash
set -a
source .env
set +a
TRADEVETO_BROWSERSTACK_MINIMAL_ARTIFACT_ROOT=../docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic \
npm --prefix frontend run test:browserstack:minimal
```

## Minimal Automate Configuration

The minimal smoke uses direct Playwright CDP connection to BrowserStack:

- BrowserStack SDK wrapper: not used for the minimal smoke
- Test timeout: 5 minutes
- Expect timeout: 30 seconds
- Connect timeout: 240 seconds
- Navigation timeout: 240 seconds
- Retries: 1
- Workers: 1
- Screenshots: off
- Video: off
- Trace: off
- BrowserStack debug: off
- BrowserStack network logs: off
- BrowserStack Local: false

## Capability Matrix

| Order | Target | Capability | Route | Assertion |
| --- | --- | --- | --- | --- |
| 1 | Desktop Chrome | Windows 11, Chrome latest | `https://tradeveto.com` | `body` visible |
| 2 | Android Chrome | Samsung Galaxy S23, Chrome | `https://tradeveto.com` | `body` visible |
| 3 | iPhone Safari | iPhone 15, Safari | `https://tradeveto.com` | `body` visible |

## Production Run Result

All three targets failed before a BrowserStack session was created.

| Target | Build created | Session count > 0 | Startup time before failure | Exact error |
| --- | --- | --- | --- | --- |
| Desktop Chrome | No | No | 897 ms | `browserType.connect: Error: Automate testing time expired.` |
| Android Chrome | No | No | 2077 ms | `browserType.connect: Error: Automate testing time expired.` |
| iPhone Safari | No | No | 1942 ms | `browserType.connect: Error: Automate testing time expired.` |

Retry #1 results:

| Target | Build created | Session count > 0 | Startup time before failure | Exact error |
| --- | --- | --- | --- | --- |
| Desktop Chrome | No | No | 1913 ms | `browserType.connect: Error: Automate testing time expired.` |
| Android Chrome | No | No | 1916 ms | `browserType.connect: Error: Automate testing time expired.` |
| iPhone Safari | No | No | 1994 ms | `browserType.connect: Error: Automate testing time expired.` |

## Dashboard URLs

No BrowserStack dashboard build or session URL was available from this run because all targets failed during `browserType.connect` before session creation.

## Artifacts

Production-generated artifacts were copied back locally under:

- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/browserstack-minimal-playwright-report.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/playwright-output/.last-run.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/01-desktop-chrome-retry-0.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/01-desktop-chrome-retry-1.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/02-android-chrome-retry-0.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/02-android-chrome-retry-1.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/03-iphone-safari-retry-0.json`
- `docs/ops/artifacts/browserstack-minimal-automate-timeout-diagnostic/session-attempts/03-iphone-safari-retry-1.json`

The attempt JSON files omit BrowserStack secret values.

## Classification

This is no longer a missing-environment-variable failure.

Production `.env` contains both required BrowserStack keys and the test was run with those variables loaded. All three targets still failed before session creation with:

```text
browserType.connect: Error: Automate testing time expired.
```

Classification: BrowserStack Automate account/entitlement/time-expired issue before session creation.

Because desktop Chrome failed before session creation, this is not isolated to real-device startup, mobile queueing, or mobile capability selection.

## Verdict

BrowserStack minimal Automate smoke failed.
