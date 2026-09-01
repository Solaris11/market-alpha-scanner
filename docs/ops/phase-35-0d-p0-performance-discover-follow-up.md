# Phase 35.0D P0 Performance And Discover Follow-Up

Generated: 2026-09-01

## Verdict

**PARTIAL P0 CLOSURE**

Two owner-prioritized P0 areas were addressed and deployed to production:

- Page load/performance: `/market-memory` server-side query pressure was reduced, and `/opportunities` initial chart bundle loading was deferred.
- Discover ticker/name search: direct packet matching and fallback symbol-card opening were tightened for ticker, company-name, share-class alias, and bare crypto-base searches.

The route-load portion of the production probe is green after deploy. The full probe still reports `not_ready` because it was run without an authenticated cookie, so premium workflow locators fail behind auth. Do not treat this unauthenticated interaction result as a final authenticated workflow certification.

## Deployed Commits

Production was fast-forwarded to:

- `18ccc94 Add Claude handover prompt`
- `aa2390c Defer opportunities chart bundle loading`
- `f5255fa Fix discover search and market memory performance`

Production host:

- `sre@100.68.155.121`
- `/opt/apps/market-alpha-scanner/app`

Deployment commands executed on the production Linux host:

```bash
git pull --ff-only origin main
docker compose --env-file .env build market-alpha-frontend market-alpha-frontend-hot-api
docker compose --env-file .env up -d market-alpha-frontend market-alpha-frontend-hot-api
```

Both frontend containers returned `healthy` after restart.

## Local Validation

Local checks passed before push:

```bash
npm --prefix frontend test -- market-memory.test.ts symbol-knowledge-graph.test.ts intelligence-discovery.test.ts
npm --prefix frontend run lint -- --pretty false
npm --prefix frontend run build
git diff --check
```

Result:

- Tests: 575 pass, 0 fail.
- TypeScript lint: pass.
- Next production build: pass.
- Diff whitespace check: pass.

## Production Health

Basic app health:

- `https://tradeveto.com/api/health`: `ok=true`, service `tradeveto-frontend`.

Deep health:

- `https://tradeveto.com/api/health/deep`: HTTP 503.
- DB: OK.
- Scanner: OK; latest scanner age was about 10 minutes during the check.
- Backup: failed/stale. Latest local/offsite backup evidence was from `2026-08-18`, roughly 19,700 minutes old at probe time.

Interpretation:

- The 503 is not from the deployed frontend code crashing.
- Backup freshness remains an open launch blocker and should stay P0/P1 ops work until current R2/local backup and restore proof is closed.

## Production Route Probe

Command executed on the production Linux host:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
TRADEVETO_PHASE275_BROWSERS=chromium \
TRADEVETO_PHASE275_SCREENSHOTS=none \
TRADEVETO_PHASE275_OUTPUT=../docs/ops/artifacts/phase-35-0c-performance-recertification/current-route-probe-after-p0-fixes.json \
npm run probe:phase27:performance
```

Artifact path on production:

- `/opt/apps/market-alpha-scanner/app/docs/ops/artifacts/phase-35-0c-performance-recertification/current-route-probe-after-p0-fixes.json`

Route-load result:

| Route | Status | Interactive | TTFB | Script Bytes |
| --- | --- | ---: | ---: | ---: |
| `/terminal` | pass | 892.382 ms | 389 ms | 888,922 |
| `/discover` | pass | 188.867 ms | 72 ms | 888,922 |
| `/scanner` | pass | 171.598 ms | 53 ms | 892,433 |
| `/symbol/AMD` | pass | 492.315 ms | 64 ms | 985,153 |
| `/history` | pass | 181.176 ms | 66 ms | 923,717 |
| `/performance` | pass | 186.111 ms | 60 ms | 960,836 |
| `/macro` | pass | 585.950 ms | 302 ms | 318,370 |
| `/feed` | pass | 394.080 ms | 288 ms | 318,370 |
| `/paper` | pass | 329.352 ms | 64 ms | 911,718 |
| `/strategy-labs` | pass | 188.858 ms | 66 ms | 1,115,099 |
| `/alerts` | pass | 163.397 ms | 51 ms | 888,509 |
| `/market-memory` | pass | 467.846 ms | 295 ms | 269,629 |
| `/status` | pass | 138.174 ms | 62 ms | 256,192 |
| `/account` | pass | 189.075 ms | 54 ms | 896,640 |
| `/settings` | pass | 162.902 ms | 52 ms | 899,842 |
| `/support` | pass | 284.958 ms | 61 ms | 888,509 |

Important delta:

- Before this fix, `/market-memory` measured around 12 seconds interactive with about 11.9 seconds TTFB in the quick production probe.
- After this fix, `/market-memory` measured 467.846 ms interactive and 295 ms TTFB.

Overall probe status:

- `not_ready`, because Chromium interaction probes failed without an authenticated premium session.
- Console/API issues were dominated by unauthenticated `/api/discovery` 401 responses.

## Code Changes

Market Memory performance:

- File: `frontend/src/lib/server/market-memory.ts`.
- Replaced a broad `OR` scan over `market_memory_snapshots` with bounded branch queries for exact symbol and exact setup/regime/score-bucket matches.
- Disabled the expensive `scanner_signals` fallback by default behind `TRADEVETO_MARKET_MEMORY_SCANNER_FALLBACK=true`.
- Production DB EXPLAIN during investigation showed the rewritten snapshot query around 83 ms execution time for the tested signal, versus the prior broad snapshot query around 1.45 seconds and scanner fallback exceeding 60 seconds.

Discover search/card open:

- Files:
  - `frontend/src/lib/trading/intelligence-discovery.ts`
  - `frontend/src/lib/trading/intelligence-discovery.test.ts`
  - `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`
- Added `resolveDiscoverySymbolMatch()` for exact tickers, `.`/`-` aliases, bare crypto bases such as `BTC -> BTC-USD`, exact company names, and company-name prefixes.
- Explicit ticker/company matches are surfaced first even if active filters would otherwise hide the row.
- Enter in the Discover search box opens the validated packet row card, or a fallback symbol card when the ticker is syntactically valid but absent from the current scanner packet.
- Added a visible search-intent row above results with an `Open card` action for validated and fallback matches.

Follow-up correction after owner screenshot:

- The first UI pass placed the fallback/validated search intent too low in the page, inside the final result grid. For searches such as `SNDK`, the top of the page still showed `0 visible` plus unrelated exploration panels, which looked broken.
- The Discover hero search and the in-page scanner search are now real submit forms with an explicit `Open` button. Pressing Enter or clicking `Open` opens the matched packet symbol card or the fallback symbol card.
- The validated/fallback card action now appears directly under the search input, so a ticker absent from the current scanner packet still gives an immediate `Open <SYMBOL> card` path instead of forcing the user to scroll to the result grid.
- The inputs were changed from browser-native `type="search"` to `type="text"` with `inputMode="search"` to avoid Chrome's built-in clear `x` being mistaken for a search/open action.

Opportunities bundle performance:

- File: `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx`.
- Claude Code identified the static import path `OpportunitiesWorkspace -> MiniPriceContextChart -> SymbolChart -> lightweight-charts`.
- The chart is now loaded with `next/dynamic` and `ssr: false` so `lightweight-charts` is not included in `/opportunities` initial client graph.
- Claude's source-graph estimate: `/opportunities` initial client source `1519 KB -> 1278 KB`; module count `114 -> 105`. These are source bytes, not minified/gzipped bundle bytes.

## Remaining Work

- Run authenticated Chromium/Firefox/WebKit route and interaction matrix with a valid `TRADEVETO_PHASE275_COOKIE`.
- Run a premium-session Discover browser proof for `NVDA`, `IREN`, company-name search such as `Nvidia`, and a fallback ticker absent from the current packet.
- Close backup freshness: restore current local backup cadence, confirm current R2 upload visibility, and run R2 restore proof.
- Continue performance work on heavier client surfaces. Claude called out `/strategy-labs` and `/terminal` as follow-up candidates.
