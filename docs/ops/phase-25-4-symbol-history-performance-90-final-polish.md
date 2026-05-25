# Phase 25.4 - Symbol / History / Performance 90+ Final Polish

Generated: 2026-05-25

## Verdict

**TRADEVETO SYMBOL/HISTORY/PERFORMANCE 90+ FINAL POLISH STRONG PARTIAL ACCOMPLISHED**

The implementation added stable production proof hooks and a browser timing probe for Symbol Detail, History, and Performance. Production deterministic proof passed with a 760-symbol large-universe fixture and 90+ maturity scores, and production browser screenshots were captured.

Full accomplishment is blocked by live browser proof failures: production page-load timings missed budgets, the browser-visible symbol search index only exposed 111 documents instead of 500+, compare restore timed out, and the saved-filter button could not be clicked because it was outside the viewport.

## Implemented Changes

- Added stable Symbol Command Search selectors for production browser timing:
  - `data-symbol-command-search`
  - `data-symbol-search-index-size`
  - `data-symbol-search-result-count`
  - `data-symbol-search-input`
  - `data-symbol-search-results`
  - `data-symbol-search-result`
- Added stable maturity score selectors for:
  - Symbol Detail
  - History
  - Performance
- Added `probe:phase25:symbol-history-performance-browser`.
- Added production browser probe for:
  - `/symbol/AMD`
  - `/history?symbol=AMD`
  - `/performance`
- Kept proof boundaries explicit:
  - no Bloomberg / TradingView / StockTitan / Finviz / Webull parity claim
  - no fabricated events, returns, fills, broker state, or trading advice claim
  - no retention certification claim

## Local Validation

All required local validation passed before deployment:

| Validation | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 513 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `git diff --check` | Pass |
| `node --check frontend/scripts/phase25-symbol-history-performance-browser-probe.mjs` | Pass |
| `node --check frontend/scripts/phase25-symbol-history-performance-polish-probe.mjs` | Pass |

## Production Deployment

Production was updated to commit `cd8b9d7` with:

```bash
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main
docker compose --env-file .env up -d --build market-alpha-frontend
```

Frontend container health after deploy:

```text
frontend_health=healthy
```

## Production Smoke

| Check | Result |
| --- | --- |
| `https://tradeveto.com/api/health` | Pass |
| `https://tradeveto.com/api/health/deep` | Pass |
| `/symbol/AMD` | 200 |
| `/history` | 200 |
| `/performance` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |

## Production Deterministic Proof

Artifact:

```text
docs/ops/artifacts/phase-25-4/symbol-history-performance/production-deterministic.json
```

| Metric | p95 | Budget | Result |
| --- | ---: | ---: | --- |
| Large-universe search | 3.566 ms | 50 ms | Pass |
| Fuzzy search | 2.600 ms | 50 ms | Pass |
| Watchlist/replay-aware search | 0.173 ms | 50 ms | Pass |
| Model build | 0.214 ms | 100 ms | Pass |

| Maturity Score | Score |
| --- | ---: |
| Symbol Detail | 100 |
| History | 100 |
| Performance | 99 |

Additional deterministic proof:

- Index size: 760
- Overall status: `ready`
- RSS memory delta: 21.605 MB

## Production Browser Proof

Artifact:

```text
docs/ops/artifacts/phase-25-4/symbol-history-performance/production-browser/symbol-history-performance-browser.json
```

Screenshots:

```text
docs/ops/artifacts/phase-25-4/symbol-history-performance/production-browser/screenshots/symbol-amd.png
docs/ops/artifacts/phase-25-4/symbol-history-performance/production-browser/screenshots/history-amd.png
docs/ops/artifacts/phase-25-4/symbol-history-performance/production-browser/screenshots/performance.png
```

Browser probe status: `not_ready`

| Surface | Browser Index | Score | Horizontal Overflow | Result |
| --- | ---: | ---: | ---: | --- |
| Symbol Detail | 111 | 100 | 0 px | Partial |
| History | 111 | 100 | 0 px | Partial |
| Performance | 111 | 100 | 0 px | Partial |

| Browser Timing | Actual | Budget | Result |
| --- | ---: | ---: | --- |
| Symbol page load | 9283.848 ms | 1000 ms | Fail |
| Symbol search open | 152.850 ms | 100 ms | Fail |
| Cached symbol search | 31.134 ms | 50 ms | Pass |
| Compare restore | 30097.607 ms | 150 ms | Fail |
| History page load | 7208.353 ms | 500 ms | Fail |
| History cached search | 60.555 ms | 50 ms | Fail |
| Performance page load | 7502.091 ms | 500 ms | Fail |
| Performance cached search | 22.241 ms | 50 ms | Pass |

Browser workflow checks:

| Check | Result |
| --- | --- |
| Symbol keyboard search | Pass |
| Symbol saved filters | Fail |
| History replay clusters | Pass |
| History event chronology | Pass |
| History macro chronology | Pass |
| Performance hit-rate analysis | Pass |
| Performance false-positive analysis | Pass |
| Performance confidence calibration | Pass |
| Performance strategy evolution | Pass |

Browser memory:

- JS heap before: 0.490 MB
- JS heap after: 52.023 MB
- JS heap delta: 51.533 MB

## Remaining Blockers

1. **500+ browser-visible symbol search proof is missing.** Deterministic proof uses 760 symbols, but production browser pages exposed only 111 documents.
2. **Page-load budgets failed.** Symbol, History, and Performance page loads were 7.2-9.3 seconds in production browser proof.
3. **Symbol search open missed budget.** Keyboard-open timing was 152.850 ms against a 100 ms target.
4. **History cached search missed budget.** History search measured 60.555 ms against a 50 ms target.
5. **Compare restore failed.** The route did not complete navigation within 30 seconds.
6. **Saved-filter workflow failed.** The button was present but outside the viewport and could not be clicked by Playwright.

## What Is Proven

- The deterministic 500+ large-universe search path is fast.
- Symbol/History/Performance maturity scoring is above 90 in deterministic and browser proof.
- Cached symbol search and Performance search meet the target in production browser proof.
- Production screenshots were captured for all target surfaces.
- No horizontal overflow was observed in the production browser proof.
- Route and health smoke passed after production deployment.

## What Is Not Proven

- Production browser 500+ symbol search.
- Production page-load timing budgets.
- Compare restore under 150 ms.
- Saved-filter clickability in the browser workflow.
- Competitor parity against Bloomberg, TradingView, StockTitan, Finviz, or Webull.
- Real-user retention or daily-driver behavior.

## Certification

Phase 25.4 is a **strong partial**. The data model, scoring, screenshots, and deterministic large-universe proof are strong, but live production browser timing and workflow blockers prevent full 90+ operational certification.
