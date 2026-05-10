# Phase 12.1 Production Parity Report

Date: 2026-05-10

## Verdict

PRODUCTION PARITY FIXED for the controlled-public-beta marketed route set.

The production app is not currently marketing the undeployed beta routes that return `404`, and the local public-route policy now matches that production reality. The route that created the blocker, `/intelligence/strategy-performance`, remains available in the local build as an application route, but it is no longer exposed as a public marketed/crawlable route until it is intentionally deployed and relaunched.

## Before

Production spot checks before the fix:

| Route | Production Status | Local Build Status | Finding |
| --- | ---: | ---: | --- |
| `/intelligence/strategy-performance` | `404` | `200` | Incorrectly launch-gated as a public marketed route. |
| `/strategy-labs` | `404` | `200` | Product/premium beta surface, not marketed publicly. |
| `/community` | `404` | `200` | Product/premium beta surface, not marketed publicly. |
| `/developers` | `404` | `200` | Developer beta surface, not marketed publicly. |
| `/team` | `404` | `200` | Team beta surface, not marketed publicly. |

Production sitemap, robots, homepage, and public intelligence page did not expose those routes. The real blocker was the local launch policy still requiring `/intelligence/strategy-performance` to return `200`.

## Changes

- Removed `/intelligence/strategy-performance` from the public sitemap route list.
- Removed strategy-performance from social crawler public preview allowlists.
- Kept strategy-labs, community, developers, team, and strategy-performance out of robots public allow surfaces.
- Removed strategy-performance from the public intelligence publishing index/internal links.
- Changed the public strategy-performance CTA away from `/strategy-labs` to the currently deployed `/performance` surface.
- Updated the controlled beta launch gate so it checks currently marketed production routes instead of future beta/product surfaces.
- Added `tools/ops/tradeveto-public-route-parity-check.sh` for repeatable public-route parity, sitemap, robots, canonical, and OG/Twitter checks.
- Updated stale Phase 11 audit/checklist notes so they no longer describe the resolved route mismatch as a current blocker.

## After

Production route parity check:

| Route Class | Result |
| --- | --- |
| Marketed public pages | All checked routes returned `200`. |
| `/robots.txt`, `/sitemap.xml`, `/og-image.png` | Returned `200`. |
| `/`, `/intelligence`, `/sitemap.xml`, `/robots.txt` | No undeployed beta route exposure. |
| Canonical metadata | Present on checked public pages. |
| OG/Twitter image metadata | Present on checked public pages. |
| `/strategy-labs`, `/community`, `/developers`, `/team`, `/intelligence/strategy-performance` | Observed as `404` in current production and treated as non-public/non-marketed beta surfaces. |

Local production-build route smoke check:

| Local Check | Result |
| --- | --- |
| `/sitemap.xml` | `200`, no strategy-performance or beta route exposure. |
| `/robots.txt` | `200`, no strategy-performance public allow exposure. |
| `/` | `200`, no undeployed beta links. |
| `/intelligence` | `200`, no undeployed beta links. |
| `/intelligence/strategy-performance`, `/strategy-labs`, `/community`, `/developers`, `/team` | `200` locally, confirming the current build contains the future/gated product routes. |

## Validation

- `tools/ops/tradeveto-public-route-parity-check.sh https://tradeveto.com`: passed.
- `tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended`: passed.
- Social crawler status check with `facebookexternalhit/1.1`: public intelligence routes returned `200`; undeployed beta routes returned `404`.
- `npm run lint`: passed.
- `npm test -- --runInBand`: passed, 354 tests.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')`: passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors and 0 warnings.
- `curl https://tradeveto.com/api/health`: HTTP `200`.
- `curl https://tradeveto.com/api/health/deep`: HTTP `200`; DB, scanner, local backup, and R2 offsite backup reported ok.
- `git diff --check`: passed.

## Monitoring

- `npm run monitoring:synthetics`: blocked locally because `TRADEVETO_MONITORING_TOKEN` is not set.
- `npm run monitoring:system`: blocked locally because `TRADEVETO_MONITORING_TOKEN` is not set.

The monitoring scripts fail closed without the ingest token. Production deep health still reports scanner and backup health as ok.

## Remaining Mismatches

- `/strategy-labs`, `/community`, `/developers`, `/team`, `/api/v1/*`, and `/intelligence/strategy-performance` are not deployed on the current production build. They must remain unmarketed until intentionally deployed.
- If strategy proof becomes a public launch requirement, deploy the current build and then re-add `/intelligence/strategy-performance` to sitemap, robots/social preview policy, public intelligence links, and the launch gate.
- Monitoring synthetics/system checks require the production monitoring token from a trusted operator environment.

## Files

- `frontend/src/app/sitemap.ts`
- `frontend/src/app/robots.txt/route.ts`
- `frontend/src/app/robots.test.ts`
- `frontend/src/lib/social-crawlers.ts`
- `frontend/src/lib/social-crawlers.test.ts`
- `frontend/src/lib/trading/intelligence-publishing.ts`
- `frontend/src/components/seo/PublicStrategyPerformanceView.tsx`
- `tools/ops/tradeveto-controlled-beta-launch-check.sh`
- `tools/ops/tradeveto-public-route-parity-check.sh`
- `docs/ops/phase-11-controlled-public-beta-launch-checklist.md`
- `docs/ops/phase-11-final-launch-readiness-scale-audit.md`
- `docs/ops/final-global-platform-audit.md`
