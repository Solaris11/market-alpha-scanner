# Phase 27.5 - Full Platform Performance Audit + Remediation

Date: 2026-05-27
Target: https://tradeveto.com
Status: Strong partial pending production redeploy and re-measurement.

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

## Remaining Work

This phase is not fully accomplished yet. The audit is now available and two scanner browser workflows pass, but these areas remain below production targets:

- Terminal and symbol route initial interactive time.
- History and performance page load budgets.
- Chart workspace restore and symbol switching.
- Symbol search open latency.
- Small but repeated CLS regressions on discovery, scanner, and alerts.
- Cross-browser Chromium/WebKit/Firefox proof must be rerun after production deploy.

## Verdict

Strong partial only. The audit and targeted remediation shipped locally, but full certification requires production redeploy and passing browser measurements across the required surfaces.
