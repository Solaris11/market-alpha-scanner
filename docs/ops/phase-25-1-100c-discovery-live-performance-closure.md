# Phase 25.1 - 100c Discovery + Live Performance Closure

Date: 2026-05-24
Production target: https://tradeveto.com
Production host: sre@100.68.155.121
Production path: /opt/apps/market-alpha-scanner/app

## Verdict

TRADEVETO 100C DISCOVERY + LIVE PERFORMANCE CLOSURE STRONG PARTIAL ACCOMPLISHED

The phase materially improved the authenticated hot paths and deployed the changes to production, but it cannot be marked fully accomplished because production 100c `/api/discovery` p95 still exceeds the 300 ms target. The best production quick-run evidence after the accepted byte-cache path was:

- `/api/discovery` 100c: p50 288 ms, p95 386 ms, p99 556 ms
- `/api/live-intelligence?intervalMs=10000` 100c: p50 162 ms, p95 220 ms, p99 478 ms
- SSE storm: 25/50/100 connection tiers passed with 0 failed connection cycles
- Provider outage simulation: fallback and recovery observed

## Production Changes

- `12e12a81` optimized discovery/live hot paths:
  - batched async `request_metrics` writes
  - cached serialized discovery/live packets
  - extended session cache TTL to reduce repeated authenticated session lookups
- `dd54a5d1` replaced per-request percentile array rebuilds with bounded rolling latency windows.
- `09b36485` cached discovery response bytes to avoid repeated hot-path body encoding.
- `fd586941` reverted the native `Response` experiment after production evidence showed it regressed 100c latency.
- `60352336` added and applied `idx_request_metrics_created_route_method_latency` for request metrics rollups.

## Validation

Local validation passed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 502 passing tests
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production deployment:

- Pulled `main` on production through `git pull --ff-only origin main`.
- Rebuilt/redeployed `market-alpha-frontend` with Docker Compose.
- Final production code after DB migration: `60352336`.

Production smoke passed:

- `/api/health` 200
- `/api/health/deep` 200
- `/terminal` 200
- `/discover` 200
- `/scanner` 200
- `/paper` 200
- `/macro` 200
- `/symbol/AMD` 200
- `/alerts` 200
- `/feed` 200
- `/market-memory` 200

## Production Probe Evidence

Artifacts are under `docs/ops/artifacts/phase-25-1/`.

| Artifact | 100c discovery p95/p99 | 100c live p95/p99 | Notes |
| --- | ---: | ---: | --- |
| `phase25-quick-60s-scale.json` | 344 / 537 ms | 208 / 470 ms | First optimized run; provider simulation was not enabled. |
| `phase25-quick-60s-scale-after-gzip.json` | 416 / 569 ms | 240 / 533 ms | Gzip response experiment regressed discovery. |
| `phase25-quick-60s-scale-after-rollups.json` | 489 / 571 ms | 281 / 467 ms | Rolling telemetry passed locally but did not improve discovery under this run. |
| `phase25-quick-60s-scale-after-byte-cache.json` | 386 / 556 ms | 220 / 478 ms | Best accepted production state. |
| `phase25-quick-60s-scale-after-native-response.json` | 718 / 1048 ms | 410 / 670 ms | Native Response experiment regressed and was reverted. |

The runs were intentionally 60-second gates. A full 15-minute certification was not run after the quick gate missed `/api/discovery` p95, because it would not honestly convert the result to accomplished.

## DB + Telemetry Evidence

- Before the new rollup index, the request metrics p95/p99 query used a parallel seq scan over `request_metrics`.
- After applying `idx_request_metrics_created_route_method_latency`, EXPLAIN shows `Index Only Scan using idx_request_metrics_created_route_method_latency`.
- The 1-hour rollup still processes a large window, so the next step should be pre-aggregated latency rollups rather than repeated percentile scans over raw metrics.

## Remaining Blockers

- `/api/discovery` still misses 100c p95 target: best accepted p95 is 386 ms, target is under 300 ms.
- Full 15-minute 100c certification was not valid to claim because the short gate missed the core discovery target.
- Request metrics rollup indexing improved scan shape, but raw percentile aggregation remains too heavy for world-class dashboards.
- `/api/discovery` server timing is often 0 ms on cache hit, so remaining latency is dominated by response/runtime/concurrency transfer overhead rather than scanner packet generation.

## Next Engineering Target

The next closure needs a more structural discovery delivery change:

- progressive discovery payload hydration
- smaller initial authenticated discovery packet
- dedicated follow-up endpoint for full-universe rows
- pre-aggregated request metric rollups
- production tuning for frontend worker/process concurrency
