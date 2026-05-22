# Phase 20.9 - Performance Ceiling + Scale Readiness

Date: 2026-05-21

## Objective

Prepare TradeVeto for higher concurrency and operational scale without making unsupported scale claims. This phase adds hot-path p99 telemetry, a scale-readiness policy model, a production probe, and explicit certification blockers for missing sustained load, chaos, authenticated coverage, websocket, database, and mobile stress evidence.

## Implemented Systems

### Discovery P99 Telemetry

Updated `/api/discovery` telemetry to expose p99 in the live performance packet and response headers:

- `X-TradeVeto-Discovery-P50`
- `X-TradeVeto-Discovery-P95`
- `X-TradeVeto-Discovery-P99`
- `X-TradeVeto-Discovery-Max`
- `X-TradeVeto-Discovery-Target`

This keeps the scanner hot path measurable beyond p95 and makes tail regressions visible.

### Scale Readiness Gate

Added `frontend/src/lib/scale-readiness.ts`.

The gate defines hot endpoint categories and certification budgets for:

- health
- scanner/discovery
- ranking
- replay
- macro
- chart
- telemetry
- live intelligence
- strategy/portfolio scenario

It reports:

- p50 / p95 / p99 / max latency
- success rate
- endpoint pass/warn/fail/insufficient status
- category scores
- cache policy boundaries
- freshness policy boundaries
- database index recommendations
- live-system stability requirements
- frontend render ceiling requirements
- blockers that prevent certification

The gate intentionally refuses to mark the system ready unless there is authenticated production coverage, sustained concurrency, database hot-path evidence, degraded provider testing, reconnect-storm testing, and mobile stress evidence.

### Production Scale Probe

Added `frontend/scripts/scale-readiness-probe.mjs` and package script:

```bash
npm --prefix frontend run monitoring:scale
```

The probe supports:

- configurable base URL
- configurable iterations
- configurable concurrency
- JSON artifact output
- optional auth header or cookie coverage
- p50 / p95 / p99 / max latency per endpoint
- explicit blockers when the probe is not enough to certify scale

Environment knobs:

- `TRADEVETO_SCALE_BASE_URL`
- `TRADEVETO_SCALE_ITERATIONS`
- `TRADEVETO_SCALE_CONCURRENCY`
- `TRADEVETO_SCALE_TIMEOUT_MS`
- `TRADEVETO_SCALE_OUTPUT`
- `TRADEVETO_SCALE_AUTHORIZATION`
- `TRADEVETO_SCALE_COOKIE`

### Admin Monitoring Tail Latency

Updated the admin monitoring slow-route drilldown to include p99 per route, not only p95. The server query now computes route-level p99 from `request_metrics`, and the dashboard shows both p95 and p99 in the slow-route list.

### Cache And Index Governance

The new scale policy documents required cache boundaries for:

- scanner/discovery packets
- replay and market memory analog packets
- macro/news packets
- chart/OHLC packets

It also defines safe index recommendations for operational monitoring hot paths:

- `request_metrics(route, created_at DESC)`
- `request_metrics(created_at DESC)`
- `monitoring_events(event_type, created_at DESC)`
- `synthetic_check_results(check_name, created_at DESC)`

These recommendations were not applied automatically to production because Phase 20.9 did not include a DB migration window or EXPLAIN/ANALYZE review.

## Regression Coverage

Added tests:

- `frontend/src/lib/scale-readiness.test.ts`
- updated `frontend/src/lib/discovery-performance.test.ts`

Coverage verifies:

- required hot endpoint categories exist
- endpoint p50/p95/p99/max calculations are deterministic
- certification is refused without sustained load and chaos evidence
- certification can only pass when endpoint budgets and operational evidence are complete
- discovery performance now includes p99

## Local Validation

Completed:

- `npm --prefix frontend run lint` - pass
- `npm --prefix frontend test -- --runInBand` - pass, 472 tests
- `npm --prefix frontend run build` - pass
- `npm --prefix frontend audit --omit=dev` - pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - pass
- `npx pyright . --pythonpath .venv/bin/python --warnings` - pass, 0 errors
- `git diff --check` - pass

## Production Deployment

Production was updated by pulling `main` on the Linux host and rebuilding/recreating `market-alpha-frontend`.

Container state:

- `market-alpha-frontend`: healthy

Production route smoke from inside the frontend container:

| Route | Status | Evidence |
| --- | ---: | --- |
| `/api/health` | 200 | ok |
| `/api/health/deep` | 200 | ok |
| `/api/discovery` | 401 | protected, p99 header present |
| `/api/ranking` | 200 | ok |
| `/api/history/replay?symbol=AMD` | 401 | protected |
| `/api/v1/macro` | 401 | protected |
| `/api/v1/replay?symbol=AMD` | 401 | protected |
| `/api/price-history/AMD?period=1y` | 401 | protected |
| `/api/live-intelligence` | 401 | protected |
| `/terminal` | 200 | ok |
| `/discover` | 200 | ok |
| `/scanner` | 200 | ok |
| `/market-memory` | 200 | ok |

Discovery p99 header proof:

- `/api/discovery`: `X-TradeVeto-Discovery-P99=1` on the protected production response during container-local smoke

## Production Probe

Probe command:

```bash
TRADEVETO_SCALE_BASE_URL=https://tradeveto.com \
TRADEVETO_SCALE_ITERATIONS=10 \
TRADEVETO_SCALE_CONCURRENCY=4 \
TRADEVETO_SCALE_OUTPUT=/tmp/tradeveto-phase-20-9-scale-probe.json \
node scripts/scale-readiness-probe.mjs
```

Artifact copied locally:

- `docs/ops/artifacts/phase-20-9-prod/scale-probe-prod.json`

Probe summary:

| Endpoint | Status | p50 | p95 | p99 | Max | Success |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/api/health` | fail | 68ms | 271ms | 271ms | 271ms | 100% |
| `/api/health/deep` | pass | 87ms | 147ms | 147ms | 147ms | 100% |
| `/api/discovery` | pass | 52ms | 61ms | 61ms | 61ms | 100% |
| `/api/ranking` | pass | 56ms | 64ms | 64ms | 64ms | 100% |
| `/api/history/replay?symbol=AMD` | pass | 100ms | 114ms | 114ms | 114ms | 100% |
| `/api/v1/replay?symbol=AMD` | pass | 100ms | 160ms | 160ms | 160ms | 100% |
| `/api/v1/macro` | pass | 63ms | 76ms | 76ms | 76ms | 100% |
| `/api/price-history/AMD?period=1y` | pass | 57ms | 64ms | 64ms | 64ms | 100% |
| `/api/analytics/events` | pass | 64ms | 103ms | 103ms | 103ms | 100% |
| `/api/live-intelligence` | pass | 51ms | 73ms | 73ms | 73ms | 100% |
| `/api/v1/portfolio/scenario` | pass | 57ms | 72ms | 72ms | 72ms | 100% |

Probe blockers:

- authenticated protected hot paths were not covered
- probe concurrency 4 below certification target 25
- probe was not a sustained 15-minute load test
- websocket/SSE reconnect storms were not tested
- degraded provider behavior was not tested
- mobile memory/render stress was not tested
- `/api/health` exceeded the strict 150ms p95 target with p95 271ms

Important limitation:

- Many protected endpoints returned fast 401 responses. That proves production routing and auth-wall stability, but it does not prove authenticated scanner, chart, replay, macro, live, or strategy hot-path performance.

## Scale Readiness Assessment

What improved:

- p99 is now visible for discovery and admin slow-route analysis.
- Scale readiness has a deterministic gate instead of subjective claims.
- The production probe proves unauthenticated/protected-route stability and fast external response for most endpoints.
- Cache and freshness policy boundaries are documented in code.
- The system now has a repeatable probe script for future CI/ops use.

What is still missing:

- sustained authenticated load test at concurrency 25+
- p95/p99 proof for authenticated full scanner/discovery responses
- p95/p99 proof for authenticated chart and strategy paths
- EXPLAIN/ANALYZE evidence for scanner, replay, macro, chart, telemetry, and memory hot paths
- production application of DB hot-path indexes
- websocket/SSE reconnect-storm testing
- degraded provider and outage simulation
- frontend large-table/watchlist DOM and memory ceiling test
- physical mobile stress test under large scanner/chart workflows
- CDN/edge cache policy verification
- independent dashboard/alert wiring for scale-readiness regressions

## Current Verdict

TRADEVETO PERFORMANCE CEILING + SCALE READINESS NOT ACCOMPLISHED
