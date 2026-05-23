# Phase 22.4 Scanner Workflow Dominance

Date: 2026-05-23

## Scope

Phase 22.4 targets professional scanner workflow maturity:

- server-backed named saved scans
- quick saved-scan reload
- default scan packs retained
- dense scanner workflow with sortable columns
- scanner row alert creation with source and risk context
- scanner drilldowns into chart, replay/history, market memory, strategy, and alerts
- large-watchlist scanner stress probe at 25/50 concurrency

## Implementation

- Added `user_saved_scans` with user ownership, unique saved-scan names, JSON filter payloads, use counts, and last-used timestamps.
- Added authenticated premium APIs:
  - `GET /api/user/saved-scans`
  - `POST /api/user/saved-scans`
  - `PATCH /api/user/saved-scans/[id]`
  - `DELETE /api/user/saved-scans/[id]`
- Extended discovery model to merge user saved scans ahead of default scan packs with data-backed match counts.
- Extended `/api/discovery` server loader to include saved scans alongside user watchlist context.
- Added scanner UI controls for saving current filter/sort/timeframe/density state and reloading saved scans.
- Added scanner alert creation from rows with persisted `source_reason` and `risk_reason` metadata.
- Added scanner drilldown links from rows/cards/detail overlays into chart, replay/history, market memory, strategy, and alerts.
- Added `frontend/scripts/phase22-scanner-workflow-probe.mjs`.

## Local Validation

- `npm --prefix frontend run lint`: pass
- `npm --prefix frontend test -- --runInBand`: pass, 482 tests
- `npm --prefix frontend run build`: pass
- `npm --prefix frontend audit --omit=dev`: pass, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: pass
- `npx pyright . --pythonpath .venv/bin/python --warnings`: pass, 0 errors
- `node --check frontend/scripts/phase22-scanner-workflow-probe.mjs`: pass
- `git diff --check`: pass

## Production Deployment

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Production pull: `080d516` -> `26999c9`
- Migration: `tools/db/run-migrations.sh`
  - Applied: `20260523_210000_user_saved_scans.sql`
  - Result: `applied=1 skipped=47`
- Rebuild/redeploy: `docker compose --env-file .env up -d --build market-alpha-frontend`
- Runtime image: `sha256:6ba88ac6cdc0d44797717175b775eb5adf1baeefc5783baac218476e360a570a`
- Container start: `2026-05-23T12:32:38.979262789Z`
- Container health: `healthy`
- Production build prune: `0 vulnerabilities`

Production checkout note:

- Existing untracked runtime log directories remained on production: `frontend/log/`, `log/`.

## Production Smoke

Post-deploy smoke against `https://tradeveto.com`:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.150824 s |
| `/api/health/deep` | 200 | 0.193780 s |
| `/terminal` | 200 | 0.314934 s |
| `/paper` | 200 | 0.197043 s |
| `/discover` | 200 | 0.158836 s |
| `/scanner` | 200 | 0.104129 s |
| `/symbol/AMD` | 200 | 0.225879 s |
| `/alerts` | 200 | 0.105767 s |
| `/api/user/saved-scans` unauthenticated | 401 | 0.107997 s |

## Production Probe

Artifact:

- `docs/ops/artifacts/phase-22-4/production-scanner-workflow-probe.json`

Probe configuration:

- Public production base URL: `https://tradeveto.com`
- Disposable authenticated premium probe user: created by production container and deleted after probe
- Probe cleanup verification: `0` remaining `phase22-scanner-*` users
- Large watchlist size: `111` production scanner symbols
- Saved scan creation through production API: HTTP 200, `64 ms`
- Tiers: 25 and 50 concurrent workers
- Duration: 300 seconds per tier
- Overall probe status: `ready`
- Blockers: none

Required targets:

- saved scan reload p95 < 300 ms
- large-watchlist discovery p95 < 600 ms
- sustained scanner tiers: 25 and 50 concurrency

Results:

| Tier | Endpoint | Samples | p50 | p95 | p99 | Max | Success | Timeout | Cache |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 25 | `/api/user/saved-scans` | 41,989 | 61 ms | 75 ms | 86 ms | 1506 ms | 100% | 0% | n/a |
| 25 | `/api/discovery` large watchlist | 77,515 | 63 ms | 78 ms | 94 ms | 477 ms | 100% | 0% | 77,510 system hits / 5 stale hits |
| 50 | `/api/user/saved-scans` | 41,720 | 85 ms | 104 ms | 127 ms | 461 ms | 100% | 0% | n/a |
| 50 | `/api/discovery` large watchlist | 78,088 | 147 ms | 174 ms | 195 ms | 789 ms | 100% | 0% | 78,076 system hits / 12 stale hits |

## Remaining Blockers

None for Phase 22.4 scanner workflow certification.

## Verdict

TRADEVETO SCANNER WORKFLOW DOMINANCE ACCOMPLISHED
