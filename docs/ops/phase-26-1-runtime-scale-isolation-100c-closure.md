# Phase 26.1 - Runtime Scale Isolation + 100c Closure

Date: 2026-05-27
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO RUNTIME SCALE ISOLATION + 100C CLOSURE STRONG PARTIAL ACCOMPLISHED

The phase materially improved production scale posture, but it did not reliably certify the required 100c discovery target.

Best final production evidence:

- `/api/discovery` 100c: p50 165 ms, p95 375 ms, p99 574 ms, failures 0.
- `/api/live-intelligence?intervalMs=10000` 100c: p50 140 ms, p95 309 ms, p99 485 ms, failures 0.
- Workflow APIs at 100c: all p95 values below 1000 ms in the best split-runtime run.
- SSE 25/50/100 storm: passed with 0 failed connection cycles.
- Provider outage simulation: fallback and recovery observed.
- Post-load production health and smoke: passed.

The blocker is exact and narrow: `/api/discovery` 100c p95 still missed the 300 ms target in the strongest run.

## Critical Baseline

Phase 25.1 did not fully certify production scale:

- Best `/api/discovery` 100c 15-minute run: p50 282 ms, p95 326 ms, p99 468 ms.
- Second `/api/discovery` 100c 15-minute run: p50 284 ms, p95 1046 ms, p99 1494 ms.
- Best `/api/live-intelligence?intervalMs=10000` 100c 15-minute run: p50 155 ms, p95 185 ms, p99 449 ms.
- Second live-intelligence 100c run: p50 157 ms, p95 468 ms, p99 742 ms.
- Workflow API outliers remained above the Phase 26.1 p95 budget of 1000 ms.

## Implemented Changes

- Reduced `/api/discovery` runtime pressure by separating initial and full packet system caches.
- Kept the initial discovery packet to 12 rows and extended stale-safe cache windows so background refreshes are less likely to contend with sustained 100c traffic.
- Preserved full-universe hydration via full packet requests; no premium data is exposed to unauthenticated users.
- Added serialized snapshot reuse for cached live-intelligence packets to avoid repeated JSON serialization on hot snapshot hits.
- Reduced the live-intelligence snapshot build cap to 24 rows so the hot response stays bounded while richer scanner context remains available through scanner/discovery surfaces.
- Added a short-lived local rate-limit fast path after DB verification to remove repeated hot-row upserts from high-concurrency developer and replay probes.
- Coalesced developer API usage writes into hourly rollup batches instead of one DB upsert per request.
- Sampled hot request metric queue work while preserving sampled p50/p95/p99 rollup telemetry.
- Added stale-safe caches for decision replay reports and symbol detail reports.
- Extended developer workflow and symbol-detail stale-safe cache windows to reduce cold sampled workflow spikes between 15-minute tiers.
- Tuned the Postgres pool with bounded connection, idle, and max settings.
- Added a reversible `market-alpha-frontend-hot-api` service in `compose.yaml`.
- Updated production Caddy routing for TradeVeto hot API paths to least-connection balance across `market-alpha-frontend:3001` and `market-alpha-frontend-hot-api:3001`.
- Tightened workflow API probe p95 budgets to 1000 ms for Phase 26.1.
- Added `npm --prefix frontend run probe:phase26:runtime-scale` as the production-scale probe command wrapper.

## Runtime Isolation

Runtime isolation was introduced after packet-level tuning still missed 100c:

- `compose.yaml` now defines `market-alpha-frontend` and `market-alpha-frontend-hot-api`.
- Both containers use the same production frontend image, environment, scanner-output mount, and networks.
- Production Caddy was backed up at `/opt/reverse-proxy/Caddyfile.bak.phase26-1-20260527T042712Z`.
- Production Caddy now routes these hot paths across both frontend containers:
  - `/api/discovery*`
  - `/api/live-intelligence*`
  - `/api/v1/opportunities*`
  - `/api/v1/portfolio/scenario*`
  - `/api/v1/replay*`
  - `/api/history/replay*`
  - `/api/symbol/*`
  - `/api/paper/account*`
  - `/api/paper/positions*`
- `caddy validate` could not run inside the Caddy container because the container hit a Go OS-thread limit while launching the CLI.
- Caddy was restarted with the new config, and `/api/health` immediately returned 200.

This split is simple and reversible, but it is not enough to certify world-class 100c discovery p95.

## Local Validation

Local validation passed before deployment:

- `POSTGRES_PASSWORD=placeholder docker compose config --quiet`
- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 516 passing tests
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

## Production Deployment

Production was pulled and rebuilt from `main`.

Runtime commits deployed:

- `88ea30f8` - Optimize hot API paths for Phase 26 scale.
- `0fb07be9` - Shrink hot intelligence packets for 100c probe.
- `658abe7f` - Minimize hot intelligence packets for 100c probe.
- `70d9e745` - Add hot API runtime isolation for 100c scale.

Production commands:

- `git pull --ff-only origin main`
- `docker compose --env-file .env up -d --build market-alpha-frontend`
- `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- production Caddy restart after hot-route config update

Final container state:

- `market-alpha-frontend` - healthy.
- `market-alpha-frontend-hot-api` - healthy.
- `market-alpha-scanner-market-alpha-postgres-1` - healthy.

## Production Smoke

Pre-load runtime-split smoke artifact:

- `docs/ops/artifacts/phase-26-1-scale/production-smoke-runtime-split-20260527.txt`

Post-load smoke artifact:

- `docs/ops/artifacts/phase-26-1-scale/production-smoke-post-load-20260527.txt`

Post-load route results:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.118 s |
| `/api/health/deep` | 200 | 0.128 s |
| `/terminal` | 200 | 0.154 s |
| `/discover` | 200 | 0.120 s |
| `/scanner` | 200 | 0.132 s |
| `/paper` | 200 | 0.280 s |
| `/strategy-labs` | 200 | 0.137 s |
| `/market-memory` | 200 | 1.924 s |
| `/symbol/AMD` | 200 | 0.241 s |
| `/alerts` | 200 | 0.123 s |
| `/feed` | 200 | 0.239 s |
| `/macro` | 200 | 0.206 s |

## Production Probe Artifacts

Artifacts are stored under `docs/ops/artifacts/phase-26-1-scale/`.

Key artifacts:

- `phase26-authenticated-scale-probe-iteration3.json`
- `phase26-authenticated-scale-probe-runtime-split.json`
- `phase26-authenticated-scale-probe-runtime-split-runner.json`
- `docker-stats-before-probe-runtime-split-20260527.txt`
- `docker-stats-during-probe-runtime-split-20260527.txt`
- `docker-stats-after-probe-runtime-split-20260527.txt`
- `docker-stats-before-probe-runtime-split-runner-20260527.txt`
- `docker-stats-during-probe-runtime-split-runner-20260527.txt`
- `docker-stats-after-probe-runtime-split-runner-20260527.txt`
- `db-explain-analyze-20260527.txt`

### Best Split-Runtime Probe

Artifact: `phase26-authenticated-scale-probe-runtime-split.json`

Overall status: `not_ready`

Only blocker:

- `100c /api/discovery fail: p95 375ms exceeds 300ms`

Hot endpoint results:

| Tier | Endpoint | p50 | p95 | p99 | Max | Failures |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 25c | `/api/discovery` | 62 ms | 98 ms | 132 ms | 2223 ms | 0 |
| 25c | `/api/live-intelligence?intervalMs=10000` | 62 ms | 97 ms | 128 ms | 808 ms | 0 |
| 50c | `/api/discovery` | 74 ms | 150 ms | 210 ms | 734 ms | 0 |
| 50c | `/api/live-intelligence?intervalMs=10000` | 72 ms | 143 ms | 197 ms | 882 ms | 0 |
| 100c | `/api/discovery` | 165 ms | 375 ms | 574 ms | 1520 ms | 0 |
| 100c | `/api/live-intelligence?intervalMs=10000` | 140 ms | 309 ms | 485 ms | 1301 ms | 0 |

100c workflow API results in this best run:

| Endpoint | p50 | p95 | p99 | Failures |
| --- | ---: | ---: | ---: | ---: |
| `/api/history/replay?symbol=AMD` | 231 ms | 526 ms | 526 ms | 0 |
| `/api/v1/replay?symbol=AMD` | 132 ms | 688 ms | 688 ms | 0 |
| `/api/v1/opportunities?limit=10` | 145 ms | 511 ms | 511 ms | 0 |
| `/api/v1/portfolio/scenario` | 336 ms | 548 ms | 548 ms | 0 |
| `/api/symbol/AMD` | 342 ms | 552 ms | 552 ms | 0 |
| `/api/paper/account` | 135 ms | 713 ms | 713 ms | 0 |
| `/api/paper/positions` | 139 ms | 438 ms | 438 ms | 0 |

SSE storm results:

| Connections | Events | Failed Cycles | Result |
| ---: | ---: | ---: | --- |
| 25 | 225 | 0 | pass |
| 50 | 450 | 0 | pass |
| 100 | 900 | 0 | pass |

Provider outage simulation:

- fallback observed: true
- recovery observed: true
- outage status codes: 200, 200
- recovery status codes: 200, 200

Memory and container behavior:

- `market-alpha-frontend` stayed below roughly 1.45 GiB during the best split run.
- `market-alpha-frontend-hot-api` stayed below roughly 1.22 GiB during the best split run.
- Postgres stayed below roughly 470 MiB.
- No container restart was observed.

### Runner Probe

Artifact: `phase26-authenticated-scale-probe-runtime-split-runner.json`

This run used a one-off `phase26-probe-runner` container so the load generator was not inside a served Caddy upstream. It did not improve the certification result.

Blockers:

- 50c `/api/discovery` p95 372 ms.
- 100c `/api/discovery` p95 602 ms, p99 1985 ms.
- 100c `/api/live-intelligence?intervalMs=10000` p95 492 ms, p99 1427 ms.
- 100c `/api/v1/portfolio/scenario` p95 2079 ms.
- 100c `/api/symbol/AMD` p95 1273 ms.

The runner probe confirms the scale gap is not only load-generator CPU contention.

## DB EXPLAIN ANALYZE

Artifact: `docs/ops/artifacts/phase-26-1-scale/db-explain-analyze-20260527.txt`

Key results:

- Request metric rollup dashboard query used `ix_request_metric_rollups_minute_bucket` and executed in 0.993 ms.
- Latest scanner signals query used `idx_scanner_signals_scan_run_rank` and executed in 1.314 ms.
- AMD price history query used `idx_symbol_price_history_symbol_ts` and executed in 0.319 ms.
- Latest scan-run lookup used a sequential scan over roughly 3432 success rows and executed in 2.764 ms. This is not a current p95 blocker, but it remains a low-effort future index candidate.

## Remaining Blocker

TradeVeto still needs one more discovery-specific scale closure step:

- `/api/discovery` must avoid enough per-request CPU/serialization/auth/monitoring overhead to bring 100c p95 from the best observed 375 ms to below 300 ms.
- The split runtime proves page rendering and API traffic can be separated, but two frontend containers are not enough to make discovery reliably pass.
- The next likely closure is either a dedicated non-Next hot API service for `/api/discovery`, or a pre-serialized edge-safe discovery response path with even less Next.js request overhead.

## Final Target Gate

Accomplished requires:

- `/api/discovery` 100c 15-minute p95 < 300 ms and p99 < 600 ms.
- `/api/live-intelligence` 100c 15-minute p95 < 400 ms and p99 < 800 ms.
- No workflow API p95 > 1000 ms at 100c.
- SSE storm 25/50/100 passes.
- Provider outage fallback/recovery passes.
- No container restart.
- No runaway memory growth.
- Production health remains green after load.

Final gate result:

- Discovery p95: fail.
- Discovery p99: pass in best split-runtime run, fail in runner run.
- Live intelligence: pass in best split-runtime run, fail in runner run.
- Workflow API p95: pass in best split-runtime run, fail in runner run.
- SSE storm: pass.
- Provider outage fallback/recovery: pass.
- Memory/container stability: pass.
- Post-load production health: pass.

Final verdict: strong partial, not full certification.
