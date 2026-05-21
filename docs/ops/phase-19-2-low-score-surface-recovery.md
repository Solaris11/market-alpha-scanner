# Phase 19.2 - Low-Score Surface Recovery

Date: 2026-05-21

## Result

Phase 19.2 is complete. This sprint did not advance to Phase 19.3 until the low-score production blockers were fixed, pushed, deployed, and revalidated.

Final status:

TRADEVETO LOW-SCORE SURFACE RECOVERY ACCOMPLISHED

## What Was Recovered

The Phase 18.9 audit identified low-score surface blockers around missing direct routes and utility-grade access patterns. The highest-impact recovery items were completed:

| Surface | Prior issue | Recovery |
| --- | --- | --- |
| `/macro` | Direct route missing; macro lived under `/intelligence/macro-regime` only | Added first-class `/macro` route using the existing real macro publishing model |
| `/feed` | Direct route missing; intelligence feed discoverability was weak | Added first-class `/feed` route with public-safe briefing, collections, symbol packets, and direct discovery links |
| `/market-memory` | 404 in production audit | Added first-class cinematic Market Memory route powered by current scanner rows and validated market-memory analogs |
| Marketing navigation | Public intelligence recovery surfaces were not visible enough | Added Feed, Macro, and Memory to top marketing navigation and footer links |
| Social crawler / sitemap | New recovered surfaces were not crawl-safe direct routes | Added `/feed`, `/macro`, and `/market-memory` to sitemap, robots, and social crawler allowlists |
| Performance budget | Recovered surfaces were not tracked | Added route budgets for `/feed`, `/macro`, and `/market-memory` |
| Overlay stability | Production mobile smoke caught `/paper` overlay scroll drift during validation | Updated stable overlay fallback scroll capture and stabilized the mobile smoke scroll-settling sequence |

## Data Rules

No fake market-memory content was introduced.

`/market-memory` uses:

- `getFullRanking()` for the current production scanner universe
- `getMarketMemoryForSignal(row)` for validated historical analogs
- existing market-memory evidence tiers, similarity scores, outcomes, reason codes, and limited-data language

When comparable evidence is unavailable, the page shows limited-memory state copy instead of inventing analogs.

## Production Validation

Production deployment:

- Pushed to `main`
- Pulled on `sre@onsre-node-01:/opt/apps/market-alpha-scanner/app`
- Rebuilt and restarted `market-alpha-frontend`
- Container health: `healthy`

Production smoke after final rebuild:

| Route | Status | Time |
| --- | ---: | ---: |
| `/api/health` | 200 | 0.307s |
| `/api/health/deep` | 200 | 0.146s |
| `/feed` | 200 | 0.271s |
| `/macro` | 200 | 0.250s |
| `/market-memory` | 200 | 1.214s |
| `/account` | 200 | 0.172s |
| `/settings` | 200 | 0.169s |
| `/support` | 200 | 0.172s |
| `/paper` | 200 | 0.167s |

Production mobile regression smoke:

- Command: `TRADEVETO_MOBILE_UX_BASE_URL=https://tradeveto.com npm --prefix frontend run test:mobile-ux`
- Result: `MOBILE_UX_SMOKE_PASSED routeChecks=36 devices=4`
- Screenshot artifact directory: `docs/ops/artifacts/mobile-emulation`
- Device profiles: iPhone Safari, Android Chrome, Facebook iOS in-app browser, Instagram iOS in-app browser

## Local Validation

Completed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand` - 429 passed
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev` - 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings` - 0 errors, 0 warnings
- `git diff --check`
- `node --check frontend/scripts/mobile-ux-smoke.mjs`

## Remaining Notes

- This closes Phase 19.2 only.
- Phase 19.3 physical mobile certification is still separate. Production mobile emulation passed, but real-device certification remains the next sprint and should not be marked complete from this work.
- Unrelated untracked files were left untouched: `docs/ops/phase-17-8-final-world-class-audit.md` and root `package.json`.
