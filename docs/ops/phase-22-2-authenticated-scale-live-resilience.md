# Phase 22.2 - Authenticated Scale + Live-Intelligence Resilience

Date: 2026-05-23

Final verdict: NOT ACCOMPLISHED

## Scope

Phase 22.2 tested authenticated production scale and live-intelligence resilience on `https://tradeveto.com` after deploying the latest `main` code to the production Linux host.

Production host path:

```bash
/opt/apps/market-alpha-scanner/app
```

## Deployment Proof

- Local implementation commits:
  - `7a78d22e` - `Add phase 22 authenticated scale probe`
  - `b8b3193c` - `Include operational scripts in frontend image`
  - `522b3c11` - `Sustain phase 22 SSE storm connections`
  - `7eb3523e` - `Add phase 22 telemetry hot-path index`
- Production git pull reached `7eb3523`.
- Production image after final rebuild: `sha256:21ba782ddbca0ef25eba62dd2713d36fa0695b372aeebc0d3af9633060df2ef3`.
- `market-alpha-frontend` remained `healthy` with restart count `0` after testing.
- `market-alpha-postgres` remained healthy.

## Local Validation

Passed:

```bash
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
git diff --check
```

Additional probe syntax validation passed:

```bash
node --check frontend/scripts/phase22-authenticated-scale-resilience-probe.mjs
```

## Production Smoke

Passed after final deploy:

- `/api/health`: `ok: true`
- `/api/health/deep`: `ok: true`, DB ok, scanner fresh at final smoke
- `/terminal`: `200`
- `/paper`: `200`
- `/discover`: `200`
- `/scanner`: `200`
- `/symbol/AMD`: `200`

## Artifacts

Production artifacts were captured under:

```bash
docs/ops/artifacts/phase-22-2/
```

Key files:

- `authenticated-scale-live-resilience.json`
- `sse-storm-rerun.json`
- `docker-stats-before.txt`
- `docker-stats-during.txt`
- `docker-stats-after.txt`
- `docker-stats-before-sse-rerun.txt`
- `docker-stats-after-sse-rerun.txt`
- `db-explain-analyze-hot-paths.txt`
- `db-explain-analyze-telemetry-after-index.txt`

## Authenticated Load Results

The probe created a temporary premium authenticated production identity, verified `/api/auth/me`, ran 15 minutes per tier, and cleaned up the probe identity.

| Tier | Endpoint | Samples | p50 | p95 | p99 | Max | Verdict |
|---:|---|---:|---:|---:|---:|---:|---|
| 25 | `/api/discovery` | 133,790 | 48 ms | 68 ms | 121 ms | 951 ms | PASS |
| 25 | `/api/live-intelligence` | 133,490 | 46 ms | 65 ms | 110 ms | 913 ms | PASS |
| 50 | `/api/discovery` | 178,535 | 84 ms | 121 ms | 260 ms | 1,198 ms | PASS |
| 50 | `/api/live-intelligence` | 178,128 | 79 ms | 104 ms | 220 ms | 1,112 ms | PASS |
| 100 | `/api/discovery` | 180,714 | 241 ms | 294 ms | 791 ms | 2,734 ms | FAIL p99 target |
| 100 | `/api/live-intelligence` | 180,722 | 148 ms | 186 ms | 654 ms | 2,567 ms | PASS |

Target comparison:

- `/api/discovery`: p95 under 300 ms passed at all tiers, but p99 under 600 ms failed at 100 concurrency.
- `/api/live-intelligence`: p95 under 400 ms and p99 under 800 ms passed at all tiers.

## Workflow API Findings

The sampled workflow APIs had 100% success and zero timeouts, but several were over budget under load:

- `/api/v1/opportunities?limit=10`: p95 3,512 ms at 25c, 2,963 ms at 50c, 5,512 ms at 100c.
- `/api/v1/portfolio/scenario`: p95 3,128 ms at 25c, 3,704 ms at 50c, 4,161 ms at 100c.
- `/api/v1/replay?symbol=AMD`: p95 1,266 ms at 25c, 2,919 ms at 50c, 4,275 ms at 100c.
- `/api/symbol/AMD`: passed at 25c, failed at 50c/100c.
- Paper account/positions APIs passed at 25c, failed at 50c/100c against the stricter probe budgets.

## SSE Storm Results

Initial SSE probe logic closed connections after one event, so a corrected stream-only rerun was deployed and captured in `sse-storm-rerun.json`.

| Stream tier | Max concurrent | Events | Failed connection cycles | Reconnect cycles | Verdict |
|---:|---:|---:|---:|---:|---|
| 25 | 25 | 225 | 0 | 3 | PASS |
| 50 | 50 | 450 | 0 | 3 | PASS |
| 100 | 100 | 900 | 0 | 3 | PASS |

## Memory And Container Stability

HTTP load run:

- Before: frontend 157.7 MiB, Postgres 258.5 MiB.
- Peak observed during run: frontend about 1.45 GiB, Postgres about 304 MiB.
- After: frontend 213.1 MiB, Postgres 269.8 MiB.
- Frontend restart count: `0`.

Focused SSE rerun:

- Before: frontend 118.8 MiB, Postgres 268 MiB.
- After: frontend 233.1 MiB, Postgres 270.5 MiB.

No runaway memory growth, reconnect storm, or container restart was observed.

## DB Proof

Core hot-path EXPLAIN/ANALYZE results:

- Latest scan run: `idx_scan_runs_completed_at`, execution `0.085 ms`.
- Scanner latest-run rows: `idx_scan_runs_completed_at` plus `idx_scanner_signals_scan_run_rank`, execution `0.386 ms`.
- Symbol API latest scanner row: `idx_scanner_signals_created_at`, execution `0.999 ms`.
- Chart price history: `idx_symbol_price_history_symbol_ts`, execution `0.919 ms`.

Telemetry hot-route rollup before the new index:

- Sequential scan over `request_metrics`.
- Rows scanned: 985,528.
- Execution: `653.837 ms`.

Applied:

```sql
CREATE INDEX IF NOT EXISTS ix_request_metrics_route_created_method_latency
  ON request_metrics(route, created_at DESC, method, latency_ms);
```

Telemetry hot-route rollup after the new index:

- `Index Only Scan` using `ix_request_metrics_route_created_method_latency`.
- Execution improved to `511.244 ms`.
- Remaining issue: percentile rollups over nearly one million recent rows still need pre-aggregated latency telemetry or bounded rollup tables.

## Provider Outage Simulation

Not accomplished.

No production-safe provider outage simulation mode was enabled. The probe recorded:

```json
{
  "fallbackObserved": false,
  "mode": "none",
  "ok": false,
  "recoveryObserved": false,
  "recoverySeconds": null
}
```

## Remaining Blockers

- `/api/discovery` missed the p99 target at 100 concurrency: 791 ms versus the 600 ms target.
- Several replay, developer, symbol, and paper workflow APIs exceeded budgets under 50/100 concurrency.
- Provider outage fallback/recovery was not proven.
- Telemetry rollup still needs aggregation despite the new covering index.

## Final Verdict

TRADEVETO AUTHENTICATED SCALE + LIVE-INTELLIGENCE RESILIENCE NOT ACCOMPLISHED
