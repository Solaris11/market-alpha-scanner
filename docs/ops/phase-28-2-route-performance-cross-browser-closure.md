# Phase 28.2 Route Performance + Cross-Browser Closure

Generated: 2026-05-28

## Verdict

TRADEVETO ROUTE PERFORMANCE + CROSS-BROWSER CLOSURE STRONG PARTIAL ACCOMPLISHED

Route load, cross-browser rendering, horizontal overflow, and CLS closure passed on production for the audited route set. The full probe remains `not_ready` because Chromium power-workflow locators were run without an authenticated premium session and could not access scanner/chart controls.

## Implementation Summary

- Replaced heavy `PosterDataVisuals` usage on common route shells with lightweight CSS/SVG primitives.
- Removed Recharts/Nivo/Visx from first-paint visual rails used by Terminal, Discovery, History, Performance, Alerts, and Symbol surfaces.
- Bounded first-render server payloads:
  - history snapshots limited to recent renderable rows while preserving aggregate depth,
  - symbol history bounded to recent 360 rows,
  - forward-return payloads reduced for Terminal/Symbol/Performance,
  - terminal chart hub initial rows reduced,
  - symbol detail default price history reduced to 2 years for initial render.
- Stabilized CLS:
  - added stable scrollbar gutter,
  - avoided desktop body-fixed scroll lock for overlays,
  - reserved first-run onboarding slot before hydration,
  - suppressed the reserved onboarding slot on utility routes.
- Added `npm --prefix frontend run probe:phase28:route-performance`.

## Changed Runtime Files

- `frontend/src/components/visual/MiniVisuals.tsx`
- `frontend/src/components/visual/CinematicIntelligencePanels.tsx`
- `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`
- `frontend/src/lib/scanner-data.ts`
- `frontend/src/lib/server/validated-price-history.ts`
- `frontend/src/lib/adapters/ScannerDataAdapter.ts`
- `frontend/src/app/terminal/page.tsx`
- `frontend/src/app/symbol/[symbol]/page.tsx`
- `frontend/src/app/performance/page.tsx`
- `frontend/src/components/onboarding/FirstRunStarterCard.tsx`
- `frontend/src/lib/client/mobile-scroll-lock.ts`
- `frontend/src/app/globals.css`
- `frontend/package.json`

## Local Validation

Passed after the final runtime change:

```bash
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
git diff --check
```

## Production Deployment Proof

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Deployed commit: `26d6b6a`
- Rebuild command:

```bash
docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api
```

Running containers after deployment:

- `market-alpha-frontend` healthy
- `market-alpha-frontend-hot-api` healthy
- `market-alpha-scanner-market-alpha-postgres-1` healthy

## Production Smoke

All returned HTTP 200:

```text
/api/health
/api/health/deep
/terminal
/discover
/scanner
/symbol/AMD
/symbol/NVDA
/history
/performance
/alerts
/feed
/macro
/market-memory
/paper
/strategy-labs
/account
/settings
/support
```

## Production Browser Probe

Command:

```bash
npm --prefix frontend run probe:phase28:route-performance
```

Artifact root:

```text
docs/ops/artifacts/phase-28-2-route-performance/
```

Primary JSON:

```text
docs/ops/artifacts/phase-28-2-route-performance/full-platform-browser-performance.json
```

Trace artifacts:

```text
docs/ops/artifacts/phase-28-2-route-performance/traces/chromium-trace.zip
docs/ops/artifacts/phase-28-2-route-performance/traces/firefox-trace.zip
docs/ops/artifacts/phase-28-2-route-performance/traces/webkit-trace.zip
```

Screenshot folders:

```text
docs/ops/artifacts/phase-28-2-route-performance/screenshots/chromium/
docs/ops/artifacts/phase-28-2-route-performance/screenshots/firefox/
docs/ops/artifacts/phase-28-2-route-performance/screenshots/webkit/
```

## Route Score Table

Max interactive and max CLS are the worst values across Chromium, Firefox, and WebKit.

| Route | Route Status | Max Interactive | Max CLS |
| --- | --- | ---: | ---: |
| /terminal | pass | 964.5 ms | 0.0000 |
| /discover | pass | 310.1 ms | 0.0005 |
| /scanner | pass | 277.9 ms | 0.0005 |
| /symbol/AMD | pass | 350.6 ms | 0.0000 |
| /history | pass | 315.9 ms | 0.0005 |
| /performance | pass | 215.9 ms | 0.0000 |
| /macro | pass | 561.4 ms | 0.0009 |
| /feed | pass | 358.3 ms | 0.0009 |
| /paper | pass | 358.8 ms | 0.0005 |
| /strategy-labs | pass | 267.5 ms | 0.0000 |
| /alerts | pass | 323.1 ms | 0.0005 |
| /market-memory | pass | 717.7 ms | 0.0009 |
| /status | pass | 204.8 ms | 0.0000 |
| /account | pass | 205.2 ms | 0.0005 |
| /settings | pass | 212.4 ms | 0.0005 |
| /support | pass | 222.1 ms | 0.0005 |

## Browser Summary

| Browser | Route Load/CLS | Overall Probe Status | Notes |
| --- | --- | --- | --- |
| Chromium | Pass | `not_ready` | Route load and CLS pass; authenticated-only workflow locators failed in public probe. |
| Firefox | Pass | `ready` | Route load and CLS pass. |
| WebKit | Pass | `ready` | Route load and CLS pass. |

## Remaining Blockers

- The full probe still reports `overallStatus=not_ready` because Chromium interaction probes require premium/authenticated UI controls:
  - scanner filter input,
  - compare panel,
  - chart workspace loaded marker,
  - fullscreen chart trigger,
  - fullscreen chart toolbar,
  - next-symbol control,
  - global symbol search input.
- The route probe was run without `TRADEVETO_PHASE275_COOKIE`, so premium workflow timing is not certified here.
- Public unauthenticated `/api/discovery` calls correctly returned 401 during route browsing; this is expected access-control behavior, but it creates console errors in the unauthenticated browser artifact.

## Final Assessment

Phase 28.2 route performance and CLS closure are materially achieved on production across Chromium, Firefox, and WebKit. The phase cannot be marked fully accomplished until the browser workflow timing probe runs with an authenticated premium test identity and proves scanner/chart interactions under the stated budgets.
