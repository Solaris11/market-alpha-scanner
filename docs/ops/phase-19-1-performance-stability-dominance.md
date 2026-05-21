# Phase 19.1 - Performance + Stability Dominance

Final status: **TRADEVETO PERFORMANCE + STABILITY DOMINANCE ACCOMPLISHED**

## Scope Control

This closes Phase 19.1 only. Phase 19.2 low-score surface recovery and Phase 19.3 physical mobile certification were not treated as complete by this sprint.

## Implemented Stability Work

- Discovery global overlay now lazy-loads the heavy scanner workspace instead of shipping it in the always-present global command bundle.
- Discovery idle prefetch now waits for browser idle time, with a delayed timeout fallback, instead of competing with initial route rendering.
- Discovery server model generation now has a 30-second process TTL cache for user-independent scanner, performance, shock, and narrative work. User watchlist context remains resolved per request.
- Scanner filtering now performs one pass before sorting instead of repeatedly allocating intermediate arrays for each filter condition.
- Stable detail overlays now use Motion as the only transform animation source. The previous CSS keyframe animation was disabled for stable overlays to remove race-condition clipping on mobile.
- Mobile stable overlays now use stricter safe-area max-height and width bounds.
- Mobile body scroll lock now has a pure style derivation helper with regression coverage for high-scroll overlay cases.

## Regression Coverage Added

- `frontend/src/lib/client/mobile-scroll-lock.test.ts`
  - Verifies high-scroll fixed body offset behavior.
  - Verifies invalid scroll/scrollbar inputs do not create phantom offset or padding.
- `frontend/scripts/mobile-ux-smoke.mjs`
  - Adds `/discover` to mobile smoke coverage.
  - Adds Facebook iOS and Instagram iOS in-app browser user-agent profiles.
  - Captures React hydration/text mismatch signatures, including React #418-style messages.
  - Records route load duration notes when mobile route load exceeds the smoke threshold.

## Local Validation

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Passed |
| `npm --prefix frontend test -- --runInBand` | Passed, 429 tests |
| `npm --prefix frontend run build` | Passed |
| `npm --prefix frontend audit --omit=dev` | Passed, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Passed, 0 errors / 0 warnings |
| `git diff --check` | Passed |
| `npm --prefix frontend run test:mobile-ux` | Passed, 36 mobile route checks |

Local mobile smoke covered iPhone Safari emulation, Android Chrome emulation, Facebook iOS in-app profile, and Instagram iOS in-app profile. The previous `/paper` Android stable-overlay clipping failure was fixed.

## Production Deployment

- Commit deployed to production: `ca8e01a`
- Production host: `onsre-node-01`
- Production app path: `/opt/apps/market-alpha-scanner/app`
- Production frontend container: `market-alpha-frontend`
- Deployment command: `git pull --ff-only` followed by `docker compose up -d --build market-alpha-frontend`

Production health after deployment:

| Check | Result |
| --- | --- |
| Container health | Healthy |
| `https://tradeveto.com/api/health` | HTTP 200, `ok: true` |
| `https://tradeveto.com/api/health/deep` | HTTP 200, database ok, scanner ok, backup ok |

## Production Route Timing Spot Check

| Route | Status | Time |
| --- | ---: | ---: |
| `/` | 200 | 0.324s |
| `/terminal` | 200 | 0.205s |
| `/dashboard` | 200 | 0.150s |
| `/discover` | 200 | 0.123s |
| `/opportunities` | 200 | 0.159s |
| `/symbol/AMD` | 200 | 0.257s |
| `/paper` | 200 | 0.151s |
| `/strategy-labs` | 200 | 0.182s |
| `/api/discovery` | 401 unauthenticated gate | 0.094s |
| `/api/health` | 200 | 0.170s |
| `/api/health/deep` | 200 | 0.125s |

## Production Mobile Smoke

Command:

```bash
TRADEVETO_MOBILE_UX_BASE_URL=https://tradeveto.com npm --prefix frontend run test:mobile-ux
```

Result:

```text
MOBILE_UX_SMOKE_PASSED routeChecks=36 devices=4 screenshots=/Users/hdtv/dev/market-alpha-scanner/docs/ops/artifacts/mobile-emulation
```

The smoke run did not report hydration mismatch failures, horizontal overflow failures, offscreen visible dialog failures, bottom-nav failures, or the previous `/paper` overlay clipping failure.

## Remaining Non-19.1 Gaps

- Physical mobile device certification is still Phase 19.3. This sprint used automated mobile/in-app browser emulation plus production smoke, not real iPhone/Android hardware.
- Several routes still have no automated stable-overlay trigger or expandable chart trigger for the smoke script to click. That is not a Phase 19.1 blocker after the `/paper` regression fix, but it should be expanded during Phase 19.3.
- Phase 19.2 low-score surface quality remains unclosed and should be handled next.

TRADEVETO PERFORMANCE + STABILITY DOMINANCE ACCOMPLISHED
