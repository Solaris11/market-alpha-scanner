# Phase 29.2 - Dedicated Discovery Hot Path Scale Closure

## Verdict

TRADEVETO DEDICATED DISCOVERY HOT PATH SCALE CLOSURE ACCOMPLISHED

Production sustained authenticated scale certification is ready for the Phase 29.2 scope. The required 100-concurrency discovery and live-intelligence latency targets passed with production evidence captured on `2026-05-28`.

## Production Build

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Production commit: `4d0983790d0d677f252b847c6f0d3729c1aa2a17`
- Deployment command: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Probe window: `2026-05-28T08:47:29+00:00` to `2026-05-28T09:39:05+00:00`
- Probe artifact: `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/phase29-2-authenticated-scale-probe.json`

## Implementation Summary

- Added an entitlement-keyed, short-lived serialized response cache for `/api/discovery` initial packets.
- Kept `/api/discovery` large-universe proof and provider outage simulation out of the response cache.
- Replaced the hot discovery route entitlement path with direct session-cookie resolution to avoid broader request middleware work.
- Preserved legal gate and premium entitlement checks before serving cached packets.
- Added response-cache telemetry status so hot response reuse is counted as a cache hit.
- Fixed discovery system cache invalidation to clear both `full` and `initial` packet variants.
- Reduced hot-route metric sampling pressure from `0.25` to `0.05` by default.
- Added `probe:phase29:discovery-scale` for isolated production Docker-runner evidence capture.

## Local Validation

All required local checks passed before deployment:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 536 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |

## Production Smoke

Pre-load and post-load production smoke passed. Post-load smoke results:

| Route | Status |
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

Evidence:

- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/production-smoke-before.txt`
- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/production-smoke-after.txt`

## Routing and Runtime Isolation

Caddy production routing sends hot API paths through both `market-alpha-frontend:3001` and `market-alpha-frontend-hot-api:3001` with `least_conn` load balancing. Verified hot paths include:

- `/api/discovery*`
- `/api/live-intelligence*`
- `/api/v1/opportunities*`
- `/api/v1/replay*`
- `/api/history/replay*`
- `/api/symbol/*`
- `/api/paper/account*`
- `/api/paper/positions*`
- `/api/v1/portfolio/scenario*`

Evidence:

- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/routing-audit.txt`

## Authenticated Scale Results

Probe settings:

- Base URL: `https://tradeveto.com`
- Auth mode: production probe user/session cookie
- Duration: 900 seconds per tier
- Tiers: 25, 50, 100 concurrency
- Timeout: 8000 ms
- Provider outage mode: header simulation

### Discovery and Live Intelligence

| Tier | Endpoint | p50 ms | p95 ms | p99 ms | Max ms | Samples | Target | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 25c | `/api/discovery` | 44 | 60 | 75 | 2462 | 218492 | p95 < 300, p99 < 600 | Pass |
| 25c | `/api/live-intelligence?intervalMs=10000` | 44 | 59 | 74 | 595 | 217805 | p95 < 400, p99 < 800 | Pass |
| 50c | `/api/discovery` | 67 | 80 | 97 | 8001 | 300066 | p95 < 300, p99 < 600 | Pass |
| 50c | `/api/live-intelligence?intervalMs=10000` | 66 | 78 | 94 | 626 | 300194 | p95 < 400, p99 < 800 | Pass |
| 100c | `/api/discovery` | 149 | 178 | 202 | 832 | 305128 | p95 < 300, p99 < 600 | Pass |
| 100c | `/api/live-intelligence?intervalMs=10000` | 120 | 145 | 167 | 772 | 303702 | p95 < 400, p99 < 800 | Pass |

The 100c discovery blocker is closed in this production run:

- Required `/api/discovery` 100c p95: `<300 ms`; observed `178 ms`.
- Required `/api/discovery` 100c p99: `<600 ms`; observed `202 ms`.
- Required `/api/live-intelligence` 100c p95: `<400 ms`; observed `145 ms`.
- Required `/api/live-intelligence` 100c p99: `<800 ms`; observed `167 ms`.

### Workflow API Preservation at 100c

No workflow API exceeded the required p95 budget of 1000 ms at 100c.

| Endpoint | p50 ms | p95 ms | p99 ms | Max ms | Samples | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/api/auth/me` | 96 | 121 | 415 | 609 | 27109 | Pass |
| `/api/user/workspace-preferences` | 98 | 126 | 403 | 665 | 13493 | Pass |
| `/api/user/chart-workspaces/AMD` | 96 | 121 | 396 | 643 | 13477 | Pass |
| `/api/user/watchlist` | 95 | 116 | 399 | 608 | 13477 | Pass |
| `/api/history/replay?symbol=AMD` | 206 | 487 | 487 | 487 | 3 | Pass |
| `/api/v1/replay?symbol=AMD` | 109 | 279 | 279 | 279 | 12 | Pass |
| `/api/v1/macro` | 100 | 426 | 426 | 426 | 12 | Pass |
| `/api/v1/opportunities?limit=10` | 102 | 436 | 436 | 436 | 12 | Pass |
| `/api/v1/portfolio/scenario` | 335 | 403 | 403 | 403 | 12 | Pass |
| `/api/symbol/AMD` | 269 | 489 | 489 | 489 | 12 | Pass |
| `/api/paper/account` | 100 | 509 | 509 | 509 | 12 | Pass |
| `/api/paper/positions` | 95 | 470 | 470 | 470 | 12 | Pass |

## SSE Storm Results

| Tier | Attempted Connections | Forced Reconnect Cycles | Events Received | Failed Connections | Status Codes | Result |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 25 | 25 | 3 | 225 | 0 | 75x 200 | Pass |
| 50 | 50 | 3 | 450 | 0 | 150x 200 | Pass |
| 100 | 100 | 3 | 900 | 0 | 300x 200 | Pass |

## Provider Outage Simulation

Header-based provider outage simulation passed:

- Fallback observed: yes
- Recovery observed: yes
- Outage status codes: `200`, `200`
- Recovery status codes: `200`, `200`
- Recovery seconds: `0`

## Docker and Memory Evidence

Serving containers stayed up and healthy after load. Container IDs were stable before and after the probe, which supports no serving-container restart during the run.

| Container | Before Memory | After Memory | Before CPU | After CPU |
| --- | ---: | ---: | ---: | ---: |
| `market-alpha-frontend` | 357.2 MiB | 194.8 MiB | 0.00% | 0.00% |
| `market-alpha-frontend-hot-api` | 115.6 MiB | 279.7 MiB | 0.00% | 0.00% |
| `market-alpha-scanner-market-alpha-postgres-1` | 1.624 GiB | 1.590 GiB | 0.18% | 0.03% |

Probe process memory:

- RSS before: 56.9 MiB
- RSS after: 138.6 MiB
- RSS delta: 81.7 MiB
- Heap used after: 17.6 MiB

Evidence:

- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/docker-stats-before.txt`
- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/docker-stats-during-01.txt` through `docker-stats-during-17.txt`
- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/docker-stats-after.txt`

## DB EXPLAIN/ANALYZE

DB hot-path proof was captured after the production load run:

- Session lookup miss path execution: `0.048 ms`
- Subscription lookup execution: `0.007 ms`
- Legal acceptance lookup execution: `0.035 ms`
- Request metric rollup lookup execution: `0.316 ms`
- Request metric rollup query used `ix_request_metric_rollups_minute_route_bucket`.

Small table scans remain for currently tiny auth/legal tables, but execution times are sub-millisecond to low-millisecond and not the active 100c bottleneck in this production run.

Evidence:

- `docs/ops/artifacts/phase-29-2-dedicated-discovery-scale/db-explain-hot-paths.txt`

## Trust Boundaries

- Premium gating remains before any discovery response-cache read.
- Legal acceptance gating remains before any discovery response-cache read.
- Outage simulation bypasses the serialized discovery response cache.
- Large-universe proof mode bypasses the serialized discovery response cache.
- No fake live labels were introduced.
- No unauthorized premium payload path was added.
- Progressive hydration preserves deeper watchlist, alert, replay, and market-memory details outside the initial packet path.

## Remaining Risks

- The 50c discovery run recorded one `8001 ms` max outlier while p95/p99 remained well under target. This does not fail the Phase 29.2 gate, but future monitoring should watch isolated max latency spikes.
- The auth/legal EXPLAIN plans use sequential scans on very small tables. They are not currently material under load, but should be revisited if table size grows or auth traffic mix changes.

## Final Result

The Phase 29.2 production evidence satisfies all mandatory scale gates:

- `/api/discovery` 100c p95 < 300 ms: Pass
- `/api/discovery` 100c p99 < 600 ms: Pass
- `/api/live-intelligence` 100c p95 < 400 ms: Pass
- `/api/live-intelligence` 100c p99 < 800 ms: Pass
- Workflow API p95 < 1000 ms at 100c: Pass
- SSE storm 25/50/100: Pass
- Provider outage simulation: Pass
- No runaway memory growth: Pass
- No serving-container restart observed: Pass
- Post-load production smoke: Pass
