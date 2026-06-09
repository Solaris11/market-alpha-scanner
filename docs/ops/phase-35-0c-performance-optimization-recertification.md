# Phase 35.0C Performance Optimization + Recertification

Generated: 2026-06-09

## Verdict

**PARTIALLY OPTIMIZED**

TradeVeto is no longer down and the production route/browser regressions found during this phase were materially improved, but the phase cannot be certified as `FULLY CERTIFIED`.

Hard blockers remain:

- Latest production scanner run exposes **362 distinct symbols**, below the 500+/1000+ expanded-universe certification target.
- Authenticated chart workspace restore is **2535 ms**, target **<250 ms**.
- Authenticated route-level symbol switch is **1147 ms**, target **<100 ms**.
- Full scan with analysis failed with **exit 137** on 2026-06-09 00:37:58 UTC.
- Offsite R2 backup sync is currently partial/failed while local backup remains OK.
- Required 1h/6h/24h stability and real mobile-browser measurements were not completed in this pass.

## Production Deployment

Final deployed commit: `143839e`

Deployment notes:

- `bcd8d4b` removed server-side peer chart prefetch from the symbol fast route.
- `4e1b868` removed a broken `networkidle` wait from the chart/scanner browser probe and tried eager chart bundling.
- `143839e` reverted eager chart bundling after production proof showed it worsened chart restore.

Health/smoke:

- `/api/health`: 200
- `/api/health/deep`: 200, app/db/scanner OK, backup warn
- Route smoke passed: `/`, `/terminal`, `/discover`, `/scanner`, `/symbol/AMD`, `/history`, `/performance`, `/feed`, `/alerts`, `/account`, `/market-memory`

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/production/post-final-deploy-health.txt`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/production/route-curl-timing-final.csv`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/production/final-production-snapshot.txt`

## Route Performance

Final curl timing after deployment:

| Route | Status | TTFB | Total |
| --- | ---: | ---: | ---: |
| `/` | 200 | 256 ms | 592 ms |
| `/terminal` | 200 | 145 ms | 247 ms |
| `/discover` | 200 | 191 ms | 401 ms |
| `/scanner` | 200 | 242 ms | 306 ms |
| `/symbol/AMD` | 200 | 185 ms | 422 ms |
| `/history` | 200 | 125 ms | 198 ms |
| `/performance` | 200 | 152 ms | 258 ms |
| `/feed` | 200 | 360 ms | 612 ms |
| `/alerts` | 200 | 168 ms | 214 ms |
| `/account` | 200 | 116 ms | 180 ms |
| `/market-memory` | 200 | 185 ms | 502 ms |

The original `/symbol/AMD` cold route sample was **5962 ms** before the prefetch fix. After deployment it stabilized around **400-660 ms** in repeated curl samples and passed browser route budgets in Firefox/WebKit.

Browser route proof:

- WebKit no-screenshot route matrix: `ready`
- Firefox no-screenshot route matrix: `ready`
- WebKit `/symbol/AMD`: **504 ms interactive**
- Firefox `/symbol/AMD`: **427 ms interactive**

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/browser-webkit-only-after-noscreenshot/webkit-route-performance-after-noscreenshot.json`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/browser-firefox-only-after-noscreenshot/firefox-route-performance-after-noscreenshot.json`

## Workflow Performance

Authenticated final workflow proof:

| Workflow | Result | Target | Status |
| --- | ---: | ---: | --- |
| Scanner ultra-dense interaction | 58 ms | <100 ms | Pass |
| Scanner filter | 25.7 ms | <150 ms | Pass |
| Scanner sort/search | 46 ms | <100 ms | Pass |
| Compare open | 27.6 ms | <150 ms | Pass |
| Saved scan restore | 41.4 ms | <250 ms | Pass |
| Row expansion | 14.2 ms | <100 ms | Pass |
| Fullscreen scanner | 28 ms | <100 ms | Pass |
| Fullscreen chart open | 1.6 ms browser metric | <150 ms | Pass |
| Chart toolbar interaction | 31.2 ms | <60 ms | Pass |
| Chart workspace restore | 2535 ms | <250 ms | Fail |
| Route-level symbol switch | 1147 ms | <100 ms | Fail |

Scanner virtualized proof:

- Total rows exposed: **362**
- Rendered rows: **74**
- Virtualized: **true**
- Horizontal overflow: **0**
- Browser heap delta: **31.464 MB**

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/workflows/authenticated-final/chart-scanner-browser-timing-final.json`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/workflows/authenticated-final/large-universe-proof-final.json`

## Database Findings

Final DB snapshot:

- Active connections are low; no lock-wait pressure was observed.
- Last 24h request metric p95 values are low for recorded API paths:
  - `/api/health/deep`: p95 48.8 ms
  - `/api/analytics/events`: p95 43 ms
  - `/api/ranking`: p95 4 ms
  - `/api/health`: p95 1 ms
- Large tables:
  - `scanner_signals`: 2897 MB, 522458 live rows
  - `request_metrics`: 1701 MB, 5582840 live rows
  - `market_memory_snapshots`: 1087 MB, 519427 live rows
  - `symbol_snapshots`: 997 MB, 380870 live rows
  - `forward_returns`: 328 MB, 346200 live rows

Finding severity: **Medium**.

Root cause:

- Historical metric and scanner/memory tables are large enough to keep long-term pressure on storage and dashboard query design.

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/db/final-db-snapshot.txt`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/db/db-latency-and-statements.txt`

Fix status:

- No emergency DB index or retention change was applied because observed hot API p95 values were low and no lock pressure was present.
- `pg_stat_statements` is not installed, so query-level attribution is incomplete.

## Background Jobs

Fast scan:

- Latest fast scan selected 500 symbols but wrote **362 scanner_signals**.
- Latest fast scan runtime: **301.4 s**.
- Previous fast scan wrote **361 scanner_signals**.

Full scan:

- `market-alpha-full-scan.service` failed with **status 137** on 2026-06-09 00:37:58 UTC.
- Logs show the full scan was still in forward-return analysis after writing 111 scanner rows.

Finding severity: **High**.

Root cause:

- Full-scan analysis is not reliably bounded under current production constraints.
- Fast-scan ingestion/scoring does not preserve the selected 500-symbol universe through to persisted scanner rows.

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/logs/final-job-logs.txt`
- `docs/ops/artifacts/phase-35-0c-performance-recertification/production/latest-scan-universe-count.txt`

Fix status:

- Not fixed in this phase.
- This blocks expanded-universe and full performance certification.

## Cache And Health Findings

Route/API cache effect:

- `/symbol/AMD` cold-tail server work improved after deferring non-critical peer chart packet prefetch.
- `/market-memory` repeated curl samples were 0.44-0.70s after warm cache.

Health endpoint:

- One final curl sweep saw `/api/health` at **9.49s**, followed by repeated samples mostly **144-400 ms** and one **3.36s** outlier.
- DB-recorded `/api/health` p95 is **1 ms**, so the evidence points to intermittent external/proxy/runtime scheduling rather than handler CPU.

Finding severity: **Medium**.

Evidence:

- `docs/ops/artifacts/phase-35-0c-performance-recertification/production/health-repeat-final.csv`

## Root Cause Register

| Severity | Finding | Root Cause | Fix | Verification |
| --- | --- | --- | --- | --- |
| Critical | None newly proven as unresolved app-down after deploy | Production pages recovered and route smoke passes | Deployed latest frontend/hot API | `post-final-deploy-health.txt` |
| High | `/symbol/AMD` cold route originally ~5962 ms | Server-side peer chart packet prefetch on the symbol fast route | Removed server-side peer chart prefetch; client still prefetches adjacent charts after mount | Final `/symbol/AMD` curl 422 ms; WebKit 504 ms; Firefox 427 ms |
| High | Full scan failed with exit 137 | Full analysis workload is not reliably bounded | Not fixed | `final-job-logs.txt` |
| High | Expanded universe not certified | Latest fast scan selected 500 but persisted only 362 distinct symbols | Not fixed | `latest-scan-universe-count.txt`; authenticated browser proof |
| High | Chart workspace restore 2535 ms | Full interactive `SymbolChart` readiness remains delayed after route shell; eager bundling worsened the result and was reverted | Probe measurement bug fixed; runtime remains unresolved | `chart-scanner-browser-timing-final.json` |
| High | Symbol switch 1147 ms | Current proof still measures route-level navigation, not in-place chart symbol replacement | Not fixed; product needs in-place symbol model/series replacement proof | `chart-scanner-browser-timing-final.json` |
| Medium | Request metrics table growth | Raw request metric table has 5.58M rows and large indexes | Not changed because current hot API p95 is low | `final-db-snapshot.txt` |
| Medium | Health endpoint external outliers | Intermittent runtime/proxy scheduling outlier; handler DB metrics remain low | Not fixed | `health-repeat-final.csv` |
| Medium | Offsite backup warning | R2 offsite sync timeout; local backup OK | Not fixed | `post-final-deploy-health.txt` |
| Medium | DB attribution gap | `pg_stat_statements` unavailable | Not fixed | `db-latency-and-statements.txt` |
| Low | Screenshot probe artifact | WebKit `/feed` screenshot timed out waiting for fonts, while no-screenshot browser pass succeeded | Classified as probe artifact | WebKit no-screenshot matrix ready |

## Certification Limits

Not completed in this pass:

- 1h, 6h, and 24h stability observation.
- Real Mobile Safari / Android Chrome route matrix.
- Authenticated 25/50/100c post-expansion load test.
- Full AI Copilot and Predictive Intelligence browser/API timing matrix.
- Disaster/backup recovery drill for the current R2 offsite failure.

These missing gates prevent `FULLY CERTIFIED`.

## Final Outcome

**PARTIALLY OPTIMIZED**

The production outage/page-load issue was addressed, browser route performance is now passing in Firefox and WebKit, and the worst symbol-route cold-tail was eliminated. However, the expanded-universe scanner output, chart workspace restore, route-level symbol switching, full-scan stability, offsite backup status, and long-duration/mobile evidence remain blocking items.
