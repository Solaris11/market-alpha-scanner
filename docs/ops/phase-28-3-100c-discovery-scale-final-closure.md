# Phase 28.3 - 100c Discovery Scale Final Closure

## Scope

Phase 28.3 closes the remaining authenticated `/api/discovery` 100-concurrency p95 gap without weakening source trust, premium access checks, stale-safe behavior, or live-intelligence coverage.

## Local Implementation

- Excluded `/api/*` from the Next proxy matcher so hot API requests do not pay page redirect/social-crawler middleware overhead.
- Added sampled, cached discovery runtime telemetry for in-process p50/p95/p99 headers instead of mutating the percentile window on every cached hot-path request.
- Made discovery response body serialization lazier so cached responses avoid repeated performance and entitlement JSON serialization.
- Increased the bounded session-user and entitlement hot cache TTLs to 120 seconds, configurable through `TRADEVETO_SESSION_USER_CACHE_TTL_MS` and `TRADEVETO_ENTITLEMENT_CACHE_TTL_MS`.
- Added `npm --prefix frontend run probe:phase28:discovery-scale` to run the production 15-minute 25/50/100c authenticated scale probe and write Phase 28.3 artifacts.

## Production Validation Plan

1. Full local validation.
2. Commit and push to `main`.
3. Production pull from `/opt/apps/market-alpha-scanner/app`.
4. Rebuild/redeploy `market-alpha-frontend` and `market-alpha-frontend-hot-api`.
5. Run production smoke before load.
6. Capture Docker stats before, during, and after load.
7. Run the 15-minute authenticated 25/50/100c probe.
8. Run provider outage header simulation, SSE storm tiers, and post-load smoke.
9. Capture DB EXPLAIN/ANALYZE evidence.

## Evidence

Artifacts are stored under:

`docs/ops/artifacts/phase-28-3-100c-discovery-scale/`

Production artifact inventory:

- `production-smoke-before.txt`
- `production-smoke-and-stats-before-run2.txt`
- `production-smoke-after-run1.txt`
- `production-smoke-after-run2.txt`
- `docker-stats-before.txt`
- `docker-stats-during-01.txt` through `docker-stats-during-17.txt`
- `docker-stats-after-run1.txt`
- `docker-stats-run2-during-01.txt` through `docker-stats-run2-during-19.txt`
- `docker-stats-after-run2.txt`
- `db-explain-hot-paths.txt`
- `phase28-3-authenticated-scale-probe-run1-container-exec.json`
- `phase28-3-authenticated-scale-probe-run2-isolated-runner.json`

## Production Deployment

- Runtime optimization commit deployed: `7a5f96e2` (`Close discovery 100c hot path overhead`).
- Probe execution fix deployed: `06cd1cdf` (`Run phase 28 discovery probe inside container`).
- Isolated probe-runner fix deployed: `4dc213fe` (`Isolate phase 28 scale probe runner`).
- Production path: `/opt/apps/market-alpha-scanner/app`.
- Production pull completed with `git pull --ff-only origin main`.
- Runtime rebuild completed with `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`.
- Caddy route audit confirmed hot paths are routed to both `market-alpha-frontend:3001` and `market-alpha-frontend-hot-api:3001` with `lb_policy least_conn`.

## Production Smoke

Pre-load smoke passed:

- `GET /api/health` - healthy.
- `GET /api/health/deep` - database, backup, and scanner health ok.
- Route smoke returned HTTP 200 for `/terminal`, `/discover`, `/scanner`, `/paper`, `/strategy-labs`, `/market-memory`, `/symbol/AMD`, `/alerts`, `/feed`, and `/macro`.

Post-load smoke after the isolated runner also passed:

- `GET /api/health` - healthy.
- `GET /api/health/deep` - database, backup, and scanner health ok.
- Route smoke returned HTTP 200 for `/terminal`, `/discover`, `/scanner`, `/paper`, `/strategy-labs`, `/market-memory`, `/symbol/AMD`, `/alerts`, `/feed`, and `/macro`.

## Production Probe Results

Run 1 executed inside a serving frontend container. It is retained as evidence, but it is not the final certification run because the probe client consumed CPU and memory inside the same runtime it was measuring.

Run 1 key result:

| Tier | Endpoint | p50 | p95 | p99 | Max | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 100c | `/api/discovery` | 180 ms | 366 ms | 530 ms | 3074 ms | Fail: p95 above 300 ms |
| 100c | `/api/live-intelligence?intervalMs=10000` | 146 ms | 297 ms | 432 ms | 2547 ms | Pass |

Run 2 used the isolated one-off Docker probe runner so the serving containers were not also running the load generator. This is the final certification run for Phase 28.3.

| Tier | Endpoint | p50 | p95 | p99 | Max | Samples | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 25c | `/api/discovery` | 66 ms | 273 ms | 613 ms | 8001 ms | 108874 | Fail: p99 above 600 ms, 1 timeout |
| 25c | `/api/live-intelligence?intervalMs=10000` | 66 ms | 262 ms | 575 ms | 2894 ms | 109151 | Pass |
| 50c | `/api/discovery` | 72 ms | 420 ms | 744 ms | 4029 ms | 163546 | Fail: p95 and p99 above target |
| 50c | `/api/live-intelligence?intervalMs=10000` | 71 ms | 407 ms | 701 ms | 3847 ms | 163970 | Fail: p95 above 400 ms |
| 100c | `/api/discovery` | 192 ms | 460 ms | 695 ms | 3753 ms | 198330 | Fail: p95 and p99 above target |
| 100c | `/api/live-intelligence?intervalMs=10000` | 161 ms | 393 ms | 601 ms | 2547 ms | 197953 | Pass |

Workflow APIs at 100c remained under the p95 1000 ms gate:

| Endpoint | p50 | p95 | p99 | Result |
| --- | ---: | ---: | ---: | --- |
| `/api/v1/opportunities?limit=10` | 118 ms | 295 ms | 295 ms | Pass |
| `/api/v1/portfolio/scenario` | 533 ms | 980 ms | 980 ms | Pass |
| `/api/v1/replay?symbol=AMD` | 125 ms | 303 ms | 303 ms | Pass |
| `/api/history/replay?symbol=AMD` | 229 ms | 331 ms | 331 ms | Pass |
| `/api/symbol/AMD` | 390 ms | 618 ms | 618 ms | Pass |
| `/api/paper/account` | 134 ms | 216 ms | 216 ms | Pass |
| `/api/paper/positions` | 134 ms | 235 ms | 235 ms | Pass |

SSE storm validation passed:

| Tier | Events | Failed Connections | Status Codes | Result |
| ---: | ---: | ---: | --- | --- |
| 25 | 225 | 0 | `200: 75` | Pass |
| 50 | 450 | 0 | `200: 150` | Pass |
| 100 | 900 | 0 | `200: 300` | Pass |

Provider outage simulation passed:

- Mode: header simulation.
- Fallback observed: yes.
- Recovery observed: yes.
- Outage status codes: `200`, `200`.
- Recovery status codes: `200`, `200`.
- Recovery seconds: `0`.

## Docker And DB Evidence

Docker stats showed no container restart and no runaway memory growth. After the isolated run:

- `market-alpha-frontend`: `213.2 MiB / 31.08 GiB`, healthy.
- `market-alpha-frontend-hot-api`: `375.9 MiB / 31.08 GiB`, healthy.
- `market-alpha-postgres`: `1.576 GiB / 31.08 GiB`, healthy.

The probe JSON reported runner memory at:

- `beforeRssMb`: `56.5`
- `afterRssMb`: `149.3`
- `deltaRssMb`: `92.8`

DB EXPLAIN/ANALYZE evidence did not show a database bottleneck on the audited hot paths:

- Session lookup miss path: `0.080 ms` execution time.
- Subscription entitlement lookup: `0.105 ms` execution time.
- Legal acceptance entitlement lookup: `0.142 ms` execution time.
- Rate-limit bucket lookup: `0.072 ms` execution time.

The production bottleneck remains runtime/request overhead around the discovery route under sustained concurrency, not a database plan failure on the audited queries.

## Local Validation

Completed on local workspace before deployment:

- `npm --prefix frontend run lint` - pass.
- `npm --prefix frontend test -- --runInBand` - pass, 531 tests.
- `npm --prefix frontend run build` - pass.
- `npm --prefix frontend audit --omit=dev` - pass, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - pass.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - pass, 0 errors.
- `git diff --check` - pass.

## Final Verdict

Phase 28.3 is not accomplished.

The implementation reduced unnecessary middleware, telemetry, serialization, and auth/entitlement overhead, and preserved live-intelligence, workflow API, SSE, provider outage, memory, and post-load smoke behavior. However, the final isolated 15-minute production run did not meet the mandatory `/api/discovery` 100c targets:

- Required `/api/discovery` 100c p95: `< 300 ms`; measured `460 ms`.
- Required `/api/discovery` 100c p99: `< 600 ms`; measured `695 ms`.

Additional failures appeared at 25c/50c discovery and 50c live-intelligence, so this cannot be certified as a strong final closure.

Remaining blockers:

- Discovery hot path still has sustained runtime/request overhead even with near-total hot-packet cache hits.
- A single 25c timeout pushed discovery p99 above target, indicating tail latency remains fragile.
- 50c live-intelligence p95 missed narrowly at `407 ms`.
- Route balancing and cache hits are working, but the process-level request handling path still needs deeper isolation or a slimmer dedicated hot API response path.
