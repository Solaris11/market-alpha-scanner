# Phase 25.1 - 100c Discovery + Live Performance Closure

Date: 2026-05-25
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO 100C DISCOVERY + LIVE PERFORMANCE CLOSURE STRONG PARTIAL ACCOMPLISHED

Phase 25.1 materially improved hot-path behavior and deployed the changes to production, but it is not fully accomplished. Production 15-minute 100-concurrency probes still missed the required latency targets:

- Required `/api/discovery` 100c: p95 < 300 ms, p99 < 600 ms.
- Best 15-minute `/api/discovery` 100c result in this phase: p50 282 ms, p95 326 ms, p99 468 ms.
- Second 15-minute run with provider outage simulation enabled regressed `/api/discovery` to p50 284 ms, p95 1046 ms, p99 1494 ms.
- Required `/api/live-intelligence` 100c: p95 < 400 ms, p99 < 800 ms.
- Best 15-minute `/api/live-intelligence?intervalMs=10000` 100c result: p50 155 ms, p95 185 ms, p99 449 ms.
- Second 15-minute run regressed live p95 to 468 ms, while p99 remained within target at 742 ms.
- Workflow API outliers remain above budget under 100c, especially replay, developer opportunities, and paper positions.

Strong partial is justified because production now has:

- Full 15-minute authenticated 25/50/100c evidence.
- SSE storm proof at 25/50/100 with 0 failed connection cycles.
- Provider outage fallback/recovery proof with header simulation.
- No observed container crash.
- No observed runaway frontend memory growth; memory recovered after load.
- Pre-aggregated request metric rollups deployed and used by admin monitoring.

## Production Changes

- `4a0782c9` optimized the authenticated discovery/live paths:
  - progressive initial discovery packet support for `/api/discovery`
  - full discovery hydration via `/api/discovery?packet=full`
  - cached serialized discovery packets by full/initial packet mode
  - live-intelligence body cache for repeated snapshot packets
  - stable snapshot timestamps for cacheable live packets
  - bounded default `/api/symbol/[symbol]` price history window
  - developer API access cache to reduce repeated key lookups
  - request metric minute rollup table and admin monitoring rollup reads
- `36e9b1b0` added second-pass optimizations:
  - reduced the default initial discovery packet to 160 symbols
  - cached developer opportunity feeds by requested limit
  - added transparent hot-path warmup metadata to the sustained scale probe

## Local Validation

Local validation passed after the final code iteration:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 511 passing tests
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`
- `node --check frontend/scripts/phase22-authenticated-scale-resilience-probe.mjs`

## Production Deployment

Production workflow completed:

- Pulled `main` on production with `git pull --ff-only origin main`.
- Applied migration `db/migrations/20260525_251600_phase25_request_metric_rollups.sql`.
- Rebuilt/redeployed `market-alpha-frontend` with Docker Compose.
- Final production commit: `36e9b1b0`.
- Production health stayed green after load.

Production smoke passed after the final deploy:

- `/api/health` 200
- `/api/health/deep` 200
- `/terminal` 200
- `/discover` 200
- `/scanner` 200
- `/paper` 200
- `/strategy-labs` 200
- `/market-memory` 200
- `/symbol/AMD` 200
- `/alerts` 200
- `/feed` 200
- `/macro` 200

## 15-Minute Production Probe Evidence

Artifacts are under `docs/ops/artifacts/phase-25-1/`.

| Artifact | Status | 100c discovery p50/p95/p99 | 100c live p50/p95/p99 | Notes |
| --- | --- | ---: | ---: | --- |
| `phase25-15m-scale-closure.json` | not_ready | 282 / 326 / 468 ms | 155 / 185 / 449 ms | Best discovery/live result; provider simulation was not enabled. Missed discovery p95 by 26 ms and workflow API budgets. |
| `phase25-15m-scale-closure-iteration2.json` | not_ready | 284 / 1046 / 1494 ms | 157 / 468 / 742 ms | Provider outage simulation passed, but 100c discovery/live regressed and workflow outliers persisted. |

First 15-minute run details:

- 25c discovery: p50 55 ms, p95 79 ms, p99 110 ms.
- 50c discovery: p50 123 ms, p95 155 ms, p99 197 ms.
- 100c discovery: p50 282 ms, p95 326 ms, p99 468 ms.
- 25c live: p50 52 ms, p95 70 ms, p99 97 ms.
- 50c live: p50 91 ms, p95 112 ms, p99 158 ms.
- 100c live: p50 155 ms, p95 185 ms, p99 449 ms.
- SSE storms: 25/50/100 passed with 0 failed connection cycles.

Second 15-minute run details:

- 25c discovery: p50 53 ms, p95 71 ms, p99 96 ms.
- 50c discovery: p50 124 ms, p95 156 ms, p99 189 ms.
- 100c discovery: p50 284 ms, p95 1046 ms, p99 1494 ms.
- 25c live: p50 51 ms, p95 66 ms, p99 92 ms.
- 50c live: p50 92 ms, p95 114 ms, p99 156 ms.
- 100c live: p50 157 ms, p95 468 ms, p99 742 ms.
- SSE storms: 25/50/100 passed with 0 failed connection cycles.
- Provider outage simulation: fallback observed, recovery observed, status 200/200.
- Warmup: 2 rounds, 14 endpoints, 28 samples, all 200.

## Workflow API Results

Workflow APIs remain the main non-hot-path blocker under 100c:

- First run 100c:
  - `/api/v1/replay?symbol=AMD`: p95 1930 ms.
  - `/api/v1/opportunities?limit=10`: p95 3000 ms, p99 3000 ms.
  - `/api/symbol/AMD`: p95 1227 ms.
  - `/api/paper/positions`: p95 2700 ms, p99 2700 ms.
- Second run 100c:
  - `/api/history/replay?symbol=AMD`: p95 1923 ms.
  - `/api/v1/replay?symbol=AMD`: p95 2793 ms, p99 2793 ms.
  - `/api/v1/opportunities?limit=10`: p95 2872 ms, p99 2872 ms.
  - `/api/paper/positions`: p95 2885 ms, p99 2885 ms.

These are not DB-index dominated in the captured plans; they correlate with 100c runtime/backpressure windows.

## Memory + Recovery Evidence

Docker stats artifacts:

- `docker-stats-during-15m-probe.txt`
- `docker-stats-during-15m-probe-iteration2.txt`
- `docker-stats-after-probe.txt`
- `docker-stats-after-probe-iteration2.txt`
- `post-probe-smoke-and-stats-20260525.txt`

Observed second-run memory profile:

- Frontend started near 761 MiB.
- Frontend stayed bounded during sustained load, generally around 1.33-1.64 GiB.
- After the load phase, frontend recovered to about 384 MiB and then 348 MiB in post-probe smoke.
- Postgres stayed bounded around 3.15-3.25 GiB during the second run.
- No container restart or health failure was observed.

## DB + Telemetry Evidence

Migration applied:

- `request_metric_rollups_minute`
- `ix_request_metric_rollups_minute_route_bucket`
- `ix_request_metric_rollups_minute_bucket`

DB plan artifact:

- `db-explain-analyze-20260525.txt`

Plan summary:

- Request rollup query over the 2-hour window completed in about 0.47 ms execution time on the current production rollup table.
- AMD bounded price history query used `idx_symbol_price_history_symbol_ts` and completed in about 0.24 ms execution time.
- Sample paper positions query completed in about 0.064 ms execution time on the current small production paper dataset.

Conclusion: the latest misses are not explained by obvious hot DB sequential scans in these sampled plans. The remaining problem is Node/runtime/network backpressure under continuous 100c pressure plus small-sample workflow API outliers.

## Remaining Blockers

- `/api/discovery` still does not reliably meet 100c p95 < 300 ms and p99 < 600 ms over 15 minutes.
- `/api/live-intelligence` can meet target, but the second production run missed p95 at 100c.
- Workflow APIs still produce high p95 outliers at 100c.
- The current Next.js single frontend container appears sensitive to continuous zero-think-time 100c pressure even when server-side packet build times are cached.
- Additional process-level scaling, endpoint isolation, or a dedicated API runtime is likely needed before this can be called fully accomplished.

## Next Engineering Target

The next closure should focus less on packet construction and more on runtime isolation and pressure control:

- split hot API routes into a dedicated API service or separate Next.js deployment
- raise frontend/API worker concurrency or horizontally scale frontend replicas
- add reverse-proxy keepalive/compression tuning evidence
- isolate sampled workflow APIs from discovery/live traffic
- add response-level caches for replay, paper positions, and developer opportunities
- run the 15-minute probe against scaled replicas with the same no-fake-live provider safeguards
