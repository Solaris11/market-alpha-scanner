# Phase 26.1 - Runtime Scale Isolation + 100c Closure

Date: 2026-05-26
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

Pending production probe.

## Critical Baseline

Phase 25.1 did not fully certify production scale:

- Best `/api/discovery` 100c 15-minute run: p50 282 ms, p95 326 ms, p99 468 ms.
- Second `/api/discovery` 100c 15-minute run: p50 284 ms, p95 1046 ms, p99 1494 ms.
- Best `/api/live-intelligence?intervalMs=10000` 100c 15-minute run: p50 155 ms, p95 185 ms, p99 449 ms.
- Second live-intelligence 100c run: p50 157 ms, p95 468 ms, p99 742 ms.
- Workflow API outliers remained above the Phase 26.1 p95 budget of 1000 ms.

## Implemented Changes

- Reduced `/api/discovery` runtime pressure by separating initial and full packet system caches.
- Kept the initial discovery packet to 40 rows and extended stale-safe cache windows so background refreshes are less likely to contend with sustained 100c traffic.
- Preserved full-universe hydration via full packet requests; no premium data is exposed to unauthenticated users.
- Added serialized snapshot reuse for cached live-intelligence packets to avoid repeated JSON serialization on hot snapshot hits.
- Reduced the live-intelligence snapshot build cap to 64 rows so the hot response stays bounded while richer scanner context remains available through scanner/discovery surfaces.
- Added a short-lived local rate-limit fast path after DB verification to remove repeated hot-row upserts from high-concurrency developer and replay probes.
- Coalesced developer API usage writes into hourly rollup batches instead of one DB upsert per request.
- Sampled raw request metric writes for hot endpoints while still writing full minute rollups for dashboards.
- Added stale-safe caches for decision replay reports and symbol detail reports.
- Tuned the Postgres pool with bounded connection, idle, and max settings.
- Tightened workflow API probe p95 budgets to 1000 ms for Phase 26.1.
- Added `npm --prefix frontend run probe:phase26:runtime-scale` as the production-scale probe command wrapper.

## Runtime Isolation Review

The current production Docker workflow still runs page rendering and API routes in the same `market-alpha-frontend` Next.js container. A horizontal split was reviewed but not introduced in this iteration because:

- `compose.yaml` pins `container_name: market-alpha-frontend`, which prevents simple Compose `--scale` usage without Caddy/upstream changes.
- The production reverse proxy appears to route to the existing frontend service name/container.
- A dedicated API container or multiple replicas is feasible, but it should be introduced as a reversible proxy/deployment change with explicit before/after Caddy evidence.

Phase 26.1 therefore isolates runtime pressure inside the current deployment first by making the hot API paths less CPU/DB intensive. If 100c still misses after this deployment, the next step is process/container isolation rather than more packet-level optimization.

## Local Validation

Local validation passed before deployment:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 516 passing tests
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`

## Production Deployment

Pending.

## Production Smoke

Pending.

Required smoke:

- `/api/health`
- `/api/health/deep`
- `/terminal`
- `/discover`
- `/scanner`
- `/paper`
- `/strategy-labs`
- `/market-memory`
- `/symbol/AMD`
- `/alerts`
- `/feed`
- `/macro`

## Production Probe Artifacts

Artifacts are stored under `docs/ops/artifacts/phase-26-1-scale/`.

Pending artifacts:

- 15-minute authenticated 25/50/100c probe JSON
- SSE 25/50/100 storm results
- Provider outage fallback/recovery proof
- Docker stats before/during/after
- DB EXPLAIN ANALYZE hot-path proof
- Post-load production smoke

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
