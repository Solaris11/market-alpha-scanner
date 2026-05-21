# Phase 19.11 — Failure Mode + Resilience UX

## Scope

Phase 19.11 adds governed failure-mode behavior for high-risk intelligence surfaces. The goal is to prevent frozen loaders, silent stale data, unstable reconnects, and generic chart/scanner failures from breaking user trust during degraded real-world conditions.

## Implemented Systems

- Central failure-mode classifier in `frontend/src/lib/resilience/failure-mode.ts`.
- Bounded retry governance with deterministic exponential backoff and maximum attempts.
- Low-bandwidth mode detection for data saver, slow network profiles, and constrained throughput.
- Session continuity key standard for scanner/chart/overlay state persistence.
- Reusable `ResilienceStatusBanner` for contextual degraded/offline/stale/failed states.
- Discovery overlay timeout protection, retry affordance, protected limited scanner snapshot, and visible failure-mode messaging.
- Premium chart renderer recovery state with governed retry instead of a generic broken chart block.
- Live intelligence stream degraded/reconnect state messaging using the same resilience banner.

## Failure Mode Coverage

| Surface | Resilience Behavior |
| --- | --- |
| Discovery / Scanner | `/api/discovery` timeout converts to protected limited snapshot, visible recovery mode, bounded retry, context preserved. |
| Charts | ECharts load failures show contextual chart recovery with retry; fallback explains renderer degradation. |
| Live Intelligence | Reconnecting/unavailable stream is labeled as last validated packet mode. |
| Stale Data | Central classifier downgrades confidence and states that aging evidence is not live intelligence. |
| Offline | Offline snapshot mode explicitly preserves the last validated screen state. |
| Low Bandwidth | Classifier switches to lightweight charts, compact scanners, and reduced animation semantics. |

## QA Plan

- Unit coverage for stale confidence downgrade, offline recovery, bounded retry behavior, low-bandwidth mode, and session continuity keys.
- Local validation:
  - `npm --prefix frontend run lint`
  - `npm --prefix frontend test -- --runInBand`
  - `npm --prefix frontend run build`
  - `npm --prefix frontend audit --omit=dev`
  - `python3 -m py_compile $(git ls-files '*.py')`
  - `npx pyright . --pythonpath .venv/bin/python --warnings`
  - `git diff --check`
- Production validation:
  - deploy latest `main`
  - `/api/health`
  - `/api/health/deep`
  - route smoke for `/terminal`, `/discover`, `/scanner`, `/dashboard`, `/opportunities`, `/symbol/AMD`

## Remaining Risks

- Physical mobile interruption testing still requires hands-on device verification for iPhone Safari, Android Chrome, Facebook in-app browser, and Instagram in-app browser.
- API outage and slow-response chaos testing is now represented in deterministic code paths, but full production chaos testing should be repeated with controlled infrastructure throttling.

## Final Status

TRADEVETO FAILURE MODE + RESILIENCE UX ACCOMPLISHED
