# Phase 21.1 - Authenticated Performance + BrowserStack Certification

Final status: **not accomplished**

Production base URL: `https://tradeveto.com`

Latest production commit: `fbfe1a42` (`Cache authenticated entitlement lookups`)

## Scope

Phase 21.1 targeted the hard blockers reopened by Phase 20.10:

- BrowserStack Automate real-device coverage for iPhone Safari and Android Chrome.
- Authenticated `/api/discovery` p95 under `300 ms`, p99 under `600 ms`.
- Authenticated `/api/live-intelligence` p95 under `400 ms`, p99 under `800 ms`.
- Production mobile QA across required flagship routes.
- Production evidence without inflated claims.

## Local Validation

Completed before the latest production deploy:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | pass |
| `npm --prefix frontend test -- --runInBand` | pass, 474 tests |
| `npm --prefix frontend run build` | pass |
| `npm --prefix frontend audit --omit=dev` | pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | pass, 0 errors / 0 warnings |
| `git diff --check` | pass |

## Production Deploy Proof

Production workflow completed:

```bash
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main
npm --prefix frontend ci --legacy-peer-deps
docker compose --env-file .env up -d --build market-alpha-frontend
```

Deploy result:

- Pulled `2c236694..fbfe1a42` from `origin/main`.
- Rebuilt `market-alpha-scanner-market-alpha-frontend:latest`.
- Recreated and started `market-alpha-frontend`.
- Post-deploy Docker build found `0` production package vulnerabilities after `npm prune --omit=dev`.

## Production Smoke Proof

Post-deploy smoke on `2026-05-23T06:53Z`:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.166721 s |
| `/api/health/deep` | 200 | 0.271005 s |
| `/terminal` | 200 | 0.446284 s |
| `/discover` | 200 | 0.130502 s |
| `/scanner` | 200 | 0.161097 s |
| `/paper` | 200 | 0.187019 s |
| `/strategy-labs` | 200 | 0.243530 s |
| `/market-memory` | 200 | 1.723178 s |

## Authenticated Performance Evidence

Artifact: `docs/ops/artifacts/phase-21-1/production-authenticated-critical-probe-after-cache.json`

Probe configuration:

- Authenticated disposable premium user created inside the production container.
- Session cookie used against public production `https://tradeveto.com`.
- Concurrency: `25`.
- Iterations: `100` per endpoint.
- Timeout: `8000 ms`.
- Cleanup: disposable production user deleted after probe.

| Endpoint | p50 | p95 | p99 | Max | Failures | Timeout rate | Cache | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `/api/discovery` | 106 ms | 248 ms | 329 ms | 357 ms | 0 | 0% | `system-hit` 100/100 | pass |
| `/api/live-intelligence` | 70 ms | 130 ms | 207 ms | 233 ms | 0 | 0% | `fresh-hit` 100/100 | pass |

Authenticated performance verdict: **pass**

The remaining latency reduction came from bounded, short-TTL in-process caching and in-flight coalescing for authenticated session-user and entitlement lookups. This reduced repeated session, subscription, and legal acceptance database work during burst concurrency while keeping browser responses `no-store`.

## BrowserStack Real-Device Evidence

Configured BrowserStack Automate platforms:

| Device | Browser | Real device | Status |
| --- | --- | --- | --- |
| iPhone 15 Pro Max | Safari | yes | fail |
| Samsung Galaxy S23 Ultra | Chrome | yes | blocked by account time on latest run |

Required routes in the Playwright real-device suite:

`/terminal`, `/discover`, `/scanner`, `/paper`, `/strategy-labs`, `/market-memory`, `/feed`, `/macro`, `/symbol/AMD`, `/alerts`, `/history`, `/performance`

Latest post-deploy BrowserStack artifact:

- Artifact: `docs/ops/artifacts/phase-21-1/browserstack-real-device-after-cache-env.log`
- TestHub build: `https://automation.browserstack.com/builds/igcozhjqfjj0hdpedeh1uwqgtprhm6j49vqh9d1m`
- Result: both configured real-device sessions failed before route execution with `browserType.connect: Error: Automate testing time expired.`
- BrowserStack session URLs: unavailable for this run.
- Screenshots/videos: unavailable for this run because sessions did not start.

Earlier BrowserStack evidence from the Phase 21.1 loop:

| Build | Device | Result |
| --- | --- | --- |
| `https://automate.browserstack.com/dashboard/v2/builds/73387d618b7dc8557d083c975ef94eb8f0f6f746` / `https://automation.browserstack.com/builds/hvfhgio7nnekbzcw60kjl3e0kx1funvnrvnea54k` | Samsung Galaxy S23 Ultra Chrome | pass |
| Same build | iPhone 15 Pro Max Safari | fail, `/macro overlay open scroll delta` was `312 ms` equivalent px delta against an allowed threshold of `8` |
| `https://automate.browserstack.com/dashboard/v2/builds/82674631cbe30b917ad63261a38b2825a8c11d77` / `https://automation.browserstack.com/builds/hyxetvq5u4ecpzzsn0urg2ifeyylh1wvwshcsypi` | iPhone 15 Pro Max Safari | fail, `/macro overlay open scroll delta` was `312` |
| Same build | Samsung Galaxy S23 Ultra Chrome | blocked, `Automate testing time expired` |

BrowserStack real-device verdict: **fail**

## Certification Verdict

Phase 21.1 cannot be marked accomplished because BrowserStack real-device certification is incomplete:

- Latest post-deploy iPhone Safari and Android Chrome sessions did not run because BrowserStack Automate testing time is expired.
- Earlier Android Chrome evidence passed, but the iPhone Safari run still failed the `/macro` overlay scroll restoration/open stability assertion.
- Facebook and Instagram in-app browser proof is still missing.

Performance is now within target, but real-device certification is not.

## Remaining Blockers

- Restore BrowserStack Automate availability and rerun the full real-device suite.
- Fix and recertify iPhone Safari `/macro` overlay scroll restoration/open stability.
- Capture passing BrowserStack session URLs, screenshots, videos, console logs, and network logs for both iPhone Safari and Android Chrome.
- Add Facebook and Instagram in-app browser proof before claiming full mobile certification.
