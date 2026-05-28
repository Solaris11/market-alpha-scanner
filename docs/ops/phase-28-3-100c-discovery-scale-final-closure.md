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

Pending production validation.
