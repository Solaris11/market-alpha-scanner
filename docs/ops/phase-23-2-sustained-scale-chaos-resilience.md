# Phase 23.2 Sustained Scale + Chaos Resilience

Date: 2026-05-23

Production target: https://tradeveto.com

Production host: `sre@100.68.155.121`

Production path: `/opt/apps/market-alpha-scanner/app`

Final deployed runtime commit: `c050d8a`

Final verdict: **TRADEVETO SUSTAINED SCALE + CHAOS RESILIENCE NOT ACCOMPLISHED**

## Scope

Phase 23.2 tested authenticated sustained production load, SSE reconnect storms, provider outage simulation, DB hot-path proof, and memory ceiling behavior.

Runtime changes deployed during this phase:

- `9f40a66` added explicit provider outage simulation metadata and degraded/fallback headers to `/api/discovery` and `/api/live-intelligence`.
- `ab53837` added bounded hot-read caches for developer intelligence and paper data, and narrowed the paper account summary query.
- `c050d8a` added stale-while-revalidate paper read caching with explicit cache invalidation after paper trade mutation.

## Local Validation

All runtime changes were validated locally before production deployment:

- `npm --prefix frontend run lint` passed.
- `npm --prefix frontend test -- --runInBand` passed: 491 tests.
- `npm --prefix frontend run build` passed.
- `npm --prefix frontend audit --omit=dev` passed: 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` passed: 0 errors.
- `git diff --check` passed.

## Production Deploy Proof

Production was pulled and rebuilt after each runtime commit. Final production proof:

- Final production commit: `c050d8a`
- Container: `market-alpha-frontend`
- Status after final deploy: healthy
- Artifact: `docs/ops/artifacts/phase-23-2/production-deploy-proof.txt`

Final production smoke after the full run:

- `https://tradeveto.com/api/health`: OK
- `https://tradeveto.com/api/health/deep`: OK
- `/terminal`: 200
- `/discover`: 200
- `/scanner`: 200
- `/paper`: 200
- `/macro`: 200
- `/symbol/AMD`: 200
- `/alerts`: 200
- `/feed`: 200
- `/market-memory`: 200

## Sustained Authenticated Probe

Full production probe artifact:

- `docs/ops/artifacts/phase-23-2/phase23-sustained-scale-chaos-full.json`

Run window:

- Started: `2026-05-23T20:45:55.716Z`
- Generated: `2026-05-23T21:35:39.391Z`
- Per-tier duration: 900 seconds
- Concurrency tiers: 25, 50, 100
- Authenticated probe user: created by production probe and cleaned up by probe flow

Core target results:

| Tier | Discovery p50 | Discovery p95 | Discovery p99 | Discovery status | Live p50 | Live p95 | Live p99 | Live status |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 25 | 58 ms | 83 ms | 116 ms | pass | 56 ms | 80 ms | 111 ms | pass |
| 50 | 127 ms | 255 ms | 428 ms | pass | 101 ms | 179 ms | 317 ms | pass |
| 100 | 515 ms | 1058 ms | 1265 ms | fail | 277 ms | 597 ms | 742 ms | fail |

Required target comparison:

- `/api/discovery` target at 100c: p95 < 300 ms, p99 < 600 ms.
- `/api/discovery` actual at 100c: p95 1058 ms, p99 1265 ms.
- `/api/live-intelligence` target at 100c: p95 < 400 ms, p99 < 800 ms.
- `/api/live-intelligence` actual at 100c: p95 597 ms, p99 742 ms.

The p99 live-intelligence target passed at 100c, but p95 missed. Discovery missed both p95 and p99 at 100c.

Additional sampled endpoint blockers:

- 25c `/api/v1/opportunities?limit=10`: p95 2941 ms, p99 2941 ms.
- 25c `/api/v1/portfolio/scenario`: p95 2951 ms, p99 2951 ms.
- 25c `/api/paper/account`: p95 899 ms.
- 25c `/api/paper/positions`: p95 875 ms.
- 50c `/api/v1/macro`: p95 1205 ms.
- 50c `/api/v1/portfolio/scenario`: p95 1206 ms.
- 100c `/api/v1/portfolio/scenario`: p95 1217 ms.
- 100c `/api/symbol/AMD`: p95 1528 ms.

## SSE Storm Test

SSE reconnect storm results passed:

| Tier | Attempted connections | Forced reconnect cycles | Events received | Failed connections | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| 25 | 25 | 3 | 225 | 0 | pass |
| 50 | 50 | 3 | 450 | 0 | pass |
| 100 | 100 | 3 | 900 | 0 | pass |

No reconnect storm failure was observed in the production probe.

## Provider Outage Simulation

Provider outage simulation passed for the implemented header-driven certification mode:

- Mode: `header-simulation`
- Outage status codes: 200, 200
- Recovery status codes: 200, 200
- Fallback observed: true
- Recovery observed: true
- Recovery seconds: 0

This proves the production API can expose degraded/fallback/stale-safe state under the certification simulation header. It does not prove a real external provider outage occurred.

## Memory Ceiling

Docker stats artifacts:

- `docker-stats-before-full.txt`
- `docker-stats-during-tier-25-*.txt`
- `docker-stats-during-tier-50-*.txt`
- `docker-stats-during-tier-100-*.txt`
- `docker-stats-during-sse-storm*.txt`
- `docker-stats-after-full.txt`
- `docker-stats-final-post-run.txt`

Observed memory profile:

- Before full run: frontend 146.4 MiB, Postgres 272.4 MiB.
- Tier 25 late: frontend 1.071 GiB, Postgres 306.4 MiB.
- Tier 50 late: frontend 1.205 GiB, Postgres 313 MiB.
- Tier 100 near end: frontend 1.24 GiB, Postgres 317.1 MiB.
- SSE late/tail: frontend 469.9 MiB, Postgres 286.2 MiB.
- After full run: frontend 340.7 MiB, Postgres 300.5 MiB.
- Final post-run: frontend 258.3 MiB, Postgres 285.5 MiB.

Conclusion: no runaway container memory growth was observed. Memory rose under load and dropped after the load phase.

Probe process memory:

- Before RSS: 56.4 MiB.
- After RSS: 150.9 MiB.
- Delta RSS: 94.5 MiB.
- After heap used: 15.5 MiB.

## DB Proof

DB EXPLAIN/ANALYZE artifact:

- `docs/ops/artifacts/phase-23-2/phase23-db-explain-analyze.txt`

Findings:

- `request_metrics_hot_routes_1h` is still too heavy for operator dashboards under load: execution time 572.519 ms with temp reads/writes and 865,967 rows scanned via `ix_request_metrics_route_created_method_latency`.
- The request metrics query used the intended index, but visibility/heap fetches and percentile aggregation remain expensive.
- `developer_api_key_lookup` and `rate_limit_bucket_lookup` used sequential scans because the tables are tiny in production; execution times were 0.021 ms and 0.024 ms respectively.
- Paper account and paper positions EXPLAINs were fast on current production cardinality, but still showed sequential scans due tiny tables. Execution times were 0.035 ms and 0.030 ms respectively.

Remaining DB work:

- Add pre-aggregated request latency rollups for p50/p95/p99 instead of computing percentiles over raw `request_metrics`.
- Reduce request-metric write and read pressure during high-concurrency certification.
- Consider VACUUM/visibility-map health for index-only scan effectiveness.

## Remaining Blockers

Phase 23.2 is not accomplished because the hard 100-concurrency latency targets were missed:

- `/api/discovery` p95 was 1058 ms, target < 300 ms.
- `/api/discovery` p99 was 1265 ms, target < 600 ms.
- `/api/live-intelligence` p95 was 597 ms, target < 400 ms.

Other operational weaknesses remain:

- Developer portfolio scenario remains near/over budget at multiple tiers.
- `/api/symbol/AMD` missed sampled p95 at 100 concurrency.
- Cold sampled developer and paper paths still create p95 misses in low-sample 25c measurements.
- Request metrics rollups remain too expensive under recent high-volume telemetry.

## Verdict

TRADEVETO SUSTAINED SCALE + CHAOS RESILIENCE NOT ACCOMPLISHED
