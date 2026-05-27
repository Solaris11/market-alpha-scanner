# Phase 27.5 - Full Platform Performance Audit + Remediation

Date: 2026-05-27
Target: https://tradeveto.com
Status: Strong partial accomplished. Production was deployed and re-measured, but certification targets are still missed.

## Scope

This phase added a reusable production browser performance audit and applied a focused chart workflow remediation. The audit covers:

- Major routes: `/terminal`, `/discover`, `/scanner`, `/symbol/AMD`, `/history`, `/performance`, `/macro`, `/feed`, `/paper`, `/strategy-labs`, `/alerts`, `/market-memory`, `/status`, `/account`, `/settings`, `/support`.
- Browser metrics: TTFB, FCP, LCP, CLS, script bytes, transfer bytes, approximate JS execution time, route interactive time, post-load settle time, memory, API request timing, traces, and optional screenshots.
- Workflow timings: scanner filter, compare open, chart restore, fullscreen chart open, chart toolbar interaction, symbol switching, and symbol search open.

Artifact root:

- `docs/ops/artifacts/phase-27-5-performance/full-platform-browser-performance.json`
- `docs/ops/artifacts/phase-27-5-performance/traces/chromium-trace.zip`

## Implemented Remediation

1. Full-platform browser probe:
   - Added `frontend/scripts/phase27-full-platform-performance-probe.mjs`.
   - Added `npm --prefix frontend run probe:phase27:performance`.
   - Supports Chromium, Firefox, and WebKit selection through `TRADEVETO_PHASE275_BROWSERS`.
   - Supports authenticated production proof through `TRADEVETO_PHASE275_COOKIE` without requiring secrets in code.
   - Separates initial interactive timing from network-settle timing so SSE/background calls are visible without inflating page interactivity.

2. Chart workflow performance:
   - Deferred fullscreen workspace persistence with idle scheduling instead of synchronous local-storage work during overlay open/close.
   - Prefetched adjacent symbol routes from chart navigation context.
   - Replaced full-page symbol switching with Next.js client navigation.
   - Deferred heavyweight fullscreen chart workstation panels until after the fullscreen shell renders.

## Authenticated Production Baseline

The authenticated Chromium run on 2026-05-27 used a short-lived production probe user. The session token was not printed and the probe user was deleted after the run.

Passing workflow timings:

| Workflow | Timing | Target | Result |
| --- | ---: | ---: | --- |
| Scanner filter | 56.4 ms | <100 ms | Pass |
| Compare open | 62.1 ms | <150 ms | Pass |

Remaining blockers from the authenticated Chromium baseline:

| Surface / Workflow | Observed | Target | Blocker |
| --- | ---: | ---: | --- |
| `/terminal` interactive | 3913.75 ms | <2000 ms | Slow initial interactive and LCP 4984 ms |
| `/symbol/AMD` interactive | 3925.842 ms | <2500 ms | Slow symbol route and LCP 4012 ms |
| `/history` interactive | 2620.018 ms | <1000 ms | Slow history load |
| `/performance` interactive | 3177.023 ms | <1000 ms | Slow performance load |
| `/strategy-labs` interactive | 2623.004 ms | <2500 ms | Slightly over target |
| `/discover` CLS | 0.2686 | <=0.25 | Layout shift over budget |
| `/scanner` CLS | 0.272 | <=0.25 | Layout shift over budget |
| `/alerts` CLS | 0.2543 | <=0.25 | Layout shift over budget |
| Chart restore | 3083.661 ms | <250 ms | Still too slow before redeploy |
| Fullscreen chart open | 161.6 ms | <150 ms | Slightly over before redeploy |
| Chart toolbar interaction | 82.8 ms | <60 ms | Over budget |
| Symbol switch | 3454.931 ms | <150 ms | Full route transition still too slow before redeploy |
| Symbol search open | 442.383 ms | <100 ms | Over budget |

Authenticated browser memory went from 0.617 MB initial probe heap to 81.751 MB after the route/workflow pass. No runaway browser crash was observed, but the route sequence still has high memory pressure and needs repeat measurement after the chart/symbol navigation remediation is deployed.

## Validation

Local validation completed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

## Production Deployment

Production deployment completed on 2026-05-27:

- Pulled `main` to `/opt/apps/market-alpha-scanner/app`.
- Deployed commit `d993b4da`.
- Rebuilt and restarted:
  - `market-alpha-frontend`
  - `market-alpha-frontend-hot-api`
- Container health was green after rebuild.

Production smoke passed:

| Route | Result |
| --- | --- |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/market-memory` | 200 |
| `/symbol/AMD` | 200 |
| `/alerts` | 200 |
| `/feed` | 200 |
| `/macro` | 200 |
| `/history` | 200 |
| `/performance` | 200 |

## Post-Deploy Browser Proof

The production browser probe was rerun after deploy with Chromium, Firefox, and WebKit. A short-lived authenticated probe user was created for the run and deleted afterward. Cookie values were not printed or committed.

Post-deploy artifact:

- `docs/ops/artifacts/phase-27-5-performance/full-platform-browser-performance.json`
- `docs/ops/artifacts/phase-27-5-performance/traces/chromium-trace.zip`
- `docs/ops/artifacts/phase-27-5-performance/traces/firefox-trace.zip`
- `docs/ops/artifacts/phase-27-5-performance/traces/webkit-trace.zip`
- `docs/ops/artifacts/phase-27-5-performance/screenshots/chromium/`

Post-deploy wins:

| Workflow | Post-deploy timing | Target | Result |
| --- | ---: | ---: | --- |
| Scanner filter | 55.7 ms | <100 ms | Pass |
| Compare open | 59.9 ms | <150 ms | Pass |
| Fullscreen chart open | 123.8 ms | <150 ms | Pass |

Post-deploy blockers:

| Browser | Surface / Workflow | Observed | Target | Result |
| --- | --- | ---: | ---: | --- |
| Chromium | `/terminal` interactive | 4206.594 ms | <2000 ms | Fail |
| Chromium | `/discover` interactive | 3241.659 ms | <2500 ms | Fail |
| Chromium | `/scanner` CLS | 0.272 | <=0.25 | Fail |
| Chromium | `/symbol/AMD` interactive | 3195.214 ms | <2500 ms | Fail |
| Chromium | `/history` interactive | 1914.356 ms | <1000 ms | Fail |
| Chromium | `/performance` interactive | 3309.736 ms | <1000 ms | Fail |
| Chromium | Chart restore | 2950.487 ms | <250 ms | Fail |
| Chromium | Chart toolbar interaction | 79.2 ms | <60 ms | Fail |
| Chromium | Symbol switch | 3663.42 ms | <150 ms | Fail |
| Chromium | Symbol search open | 233.284 ms | <100 ms | Fail |
| Firefox | `/terminal` interactive | 6664.44 ms | <2000 ms | Fail |
| Firefox | `/symbol/AMD` interactive | 6347.995 ms | <2500 ms | Fail |
| Firefox | `/history` interactive | 1883.906 ms | <1000 ms | Fail |
| Firefox | `/performance` interactive | 5493.693 ms | <1000 ms | Fail |
| WebKit | `/terminal` interactive | 7444.755 ms | <2000 ms | Fail |
| WebKit | `/symbol/AMD` interactive | 5450.95 ms | <2500 ms | Fail |
| WebKit | `/history` interactive | 2154.433 ms | <1000 ms | Fail |
| WebKit | `/performance` interactive | 17516.133 ms | <1000 ms | Fail |

Chromium browser heap moved from 0.617 MB at start to 79.729 MB after the route/workflow pass. No browser crash occurred, but the session still shows high memory pressure on rich surfaces.

## Remaining Work

This phase is not fully accomplished. The audit is now available and three important Chromium interactions pass after remediation, but these areas remain below production targets:

- Terminal and symbol route initial interactive time.
- History and performance page load budgets.
- Chart workspace restore, chart toolbar interaction, and symbol switching.
- Symbol search open latency.
- Small but repeated CLS regressions on discovery, scanner, and alerts.
- Firefox and WebKit page timing regressions.
- `/api/discovery` browser-observed outliers still appear during route sequences even though most requests are fast.

## Verdict

Strong partial only. The audit tooling, production deployment, browser artifacts, and targeted chart remediation are complete. Full certification is blocked by remaining route, chart restore, symbol workflow, CLS, and cross-browser timing failures.
