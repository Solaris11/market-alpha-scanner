# Phase 21.3 Live Intelligence + Scanner Performance

Date: 2026-05-23
Production target: https://tradeveto.com
Performance commit deployed for probe: `5e39861`

## Verdict

Phase 21.3 endpoint targets passed under authenticated production load.

## Implemented Fixes

- Scanner hot path: extended authenticated discovery hot-packet cache from 90 seconds to 180 seconds.
- Watchlist personalization: added short-lived per-user watchlist cache with mutation invalidation and batched insert path.
- Live packet splitting: live-intelligence now builds from a bounded top-160 scanner packet for the hot live route instead of rebuilding full-universe opportunity context.
- Live cache-hit optimization: added cold-build in-flight coalescing so concurrent live requests share the same scanner-derived packet build.
- Degraded-mode fallback: retained the bounded 260 ms live warmup budget and fallback packet path while background warming completes.
- Authenticated entitlement hot path: extended entitlement cache to 10 seconds to reduce repeated subscription/legal joins during authenticated bursts.
- Dashboard telemetry: hot endpoint runtime target checks now require p95 and p99 budgets, not p95 alone.
- Sustained probe tooling: added `npm --prefix frontend run probe:phase21:critical-performance` for authenticated discovery/live-intelligence concurrency plus EventSource stream stability.

## Local Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 474 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |

## Production Deploy Proof

Production host: `sre@100.68.155.121`
Production path: `/opt/apps/market-alpha-scanner/app`

Deployment actions completed:

- `git pull --ff-only origin main`
- `npm --prefix frontend ci --legacy-peer-deps`
- `docker compose --env-file .env up -d --build market-alpha-frontend`

Production Docker build pruned runtime dependencies and reported `found 0 vulnerabilities`.

Production proof artifact:

- `docs/ops/artifacts/phase-21-3/production-deploy-proof.txt`

## Production Smoke

Post-probe production smoke on commit `5e39861`:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.093363s |
| `/api/health/deep` | 200 | 0.104372s |
| `/terminal` | 200 | 0.128575s |
| `/discover` | 200 | 0.110817s |
| `/scanner` | 200 | 0.128758s |

Container status: `market-alpha-frontend` healthy.

## Authenticated Production Probe

Artifact:

- `docs/ops/artifacts/phase-21-3/production-critical-performance-compact.json`

Probe configuration:

- Disposable premium user created inside the production frontend container.
- Session cookie used against public production `https://tradeveto.com`.
- Disposable user cleanup verified: `remaining_probe_users=0`.
- Concurrency: 25 workers.
- Endpoint duration: 60 seconds per endpoint.
- Timeout: 8000 ms.
- Stream probe: 25 concurrent EventSource live-intelligence streams for 35 seconds.

### Endpoint Results

| Endpoint | Samples | p50 | p95 | p99 | Max | Failures | Timeout Rate | Cache | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `/api/discovery` | 14,251 | 100 ms | 150 ms | 188 ms | 465 ms | 0 | 0% | `system-hit` 14,251 | Pass |
| `/api/live-intelligence` | 19,388 | 58 ms | 157 ms | 280 ms | 700 ms | 0 | 0% | `fresh-hit` 19,135; `stale-hit` 253 | Pass |

Targets:

- `/api/discovery`: p95 under 300 ms and p99 under 600 ms.
- `/api/live-intelligence`: p95 under 400 ms and p99 under 800 ms.

Both endpoints passed.

### Stream Stability

TradeVeto live intelligence uses EventSource/SSE rather than a WebSocket transport.

| Check | Result |
| --- | ---: |
| Concurrent stream connections | 25 |
| Opened streams | 25 |
| Stream status codes | 25 x 200 |
| Live intelligence events received | 50 |
| Stream errors | 0 |
| Verdict | Pass |

## Memory / Container Stability

Artifacts:

- `docs/ops/artifacts/phase-21-3/docker-stats-before.jsonl`
- `docs/ops/artifacts/phase-21-3/docker-stats-after.jsonl`

Before probe:

- Memory: 666.5 MiB / 31.08 GiB
- PIDs: 43
- CPU: 0.02%

After probe:

- Memory: 1.034 GiB / 31.08 GiB
- PIDs: 43
- CPU: 10.47% at sample time

No runaway process growth was observed; PID count remained stable.

## Remaining Blockers

No Phase 21.3 endpoint-latency blocker remains for the declared `/api/discovery` and `/api/live-intelligence` p95/p99 targets.
