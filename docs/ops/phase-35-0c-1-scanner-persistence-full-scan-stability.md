# Phase 35.0C.1 Scanner Persistence + Full-Scan Stability Closure

Date: 2026-06-10 UTC

## Verdict

SCANNER PERSISTENCE AND FULL-SCAN STABILITY ACCOMPLISHED

## Scope

Phase 35.0C.1 targeted the remaining scanner-side blockers from Phase 35.0C:

- 500 selected symbols previously persisted only a partial distinct-symbol set.
- 1000 selected symbols previously persisted only a partial scanner-signal set.
- Full scan with analysis previously failed with exit 137.
- Selected symbols had no explicit terminal state for filtered/provider/writeback outcomes.

## Implementation Summary

Changed files:

- `scanner/drop_reasons.py`
- `scanner/engine.py`
- `investment_scanner_mvp.py`
- `database/writeback.py`
- `scanner/analysis.py`
- `scanner/safety.py`
- `tests/test_scanner_drop_reasons.py`
- `tests/test_scanner_safety.py`

Implemented:

- Per-selected-symbol scanner accounting.
- Explicit terminal states: `ranked`, `filtered_liquidity`, `filtered_market_cap`, `filtered_stale`, `filtered_low_confidence`, `provider_unavailable`, `provider_partial`, `writeback_failed`, `deduplicated`, `unknown`.
- CSV and JSON drop-reason reports for every scan.
- Scan-run metadata persistence for scanner accounting summaries.
- Writeback failure reclassification if database persistence writes fewer rows than ranked rows.
- Analysis memory reduction by limiting market-memory refresh to the latest scan run.
- Signal lifecycle row limiting through `analysis-max-signal-rows`.
- Shared scanner lock under `scanner_output/run.lock` so scheduled and manual scans cannot run concurrently through different output folders.

## Local Validation

All required local checks passed after the scanner accounting and shared-lock changes:

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 572/572 |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |
| `.venv/bin/python -m unittest tests.test_scanner_safety tests.test_scanner_drop_reasons` | Pass, 6/6 |

## Production Deployment

Production host:

- `sre@100.68.155.121`

Production path:

- `/opt/apps/market-alpha-scanner/app`

Deployed commits:

- `38dc1677` - scanner drop-reason accounting
- `5d93c049` - shared scanner run lock

Production actions:

- `git pull --ff-only origin main`
- `docker compose --env-file .env --profile scanner-job build market-alpha-scanner-job`
- Stale scanner lock files removed only after confirming old proof containers were stopped.

## Duplicate Execution Closure

Before the shared-lock fix, a scheduled scan and manual proof scan could run at the same time because the lock file lived inside each output directory.

Production proof after the fix:

| Time UTC | Event | Result |
| --- | --- | --- |
| 2026-06-10 00:36:15 | Scheduled fast scan attempted while manual proof was active | `[scanner] another run in progress, skipping` |
| 2026-06-10 00:36:15 | Scheduled scan runtime | `0.0s` |
| During manual 500 run | Active scanner-job containers | One active scanner-job container |

This closes the duplicate-work/orphan pressure path observed during proof setup.

## 500-Symbol Accounting Proof

Production command shape:

- `python investment_scanner_mvp.py --fast --no-save-history --timing --universe-size 500 --outdir /app/scanner_output/phase35c1_500_shared`

Evidence:

- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/500-scanner-drop-reasons.json`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/500-scanner-drop-reasons.csv`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/scan-500-shared.log`

| Metric | Result |
| --- | ---: |
| Selected | 500 |
| Unique to scan | 500 |
| Accounted | 500 |
| Ranked | 335 |
| Filtered liquidity | 126 |
| Filtered market cap | 23 |
| Provider partial | 16 |
| Writeback failed | 0 |
| Deduplicated | 0 |
| Unknown | 0 |
| DB scanner signals written | 335 |
| Total runtime | 1793.4s |

Result: Pass. `ranked + filtered + failed = 500`, `unknown = 0`.

## 1000-Symbol Accounting Proof

Production command shape:

- `python investment_scanner_mvp.py --fast --no-save-history --timing --universe-size 1000 --outdir /app/scanner_output/phase35c1_1000_shared`

Evidence:

- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/1000-scanner-drop-reasons.json`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/1000-scanner-drop-reasons.csv`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/scan-1000-shared.log`

| Metric | Result |
| --- | ---: |
| Selected | 1000 |
| Unique to scan | 1000 |
| Accounted | 1000 |
| Ranked | 526 |
| Filtered liquidity | 392 |
| Filtered market cap | 27 |
| Provider partial | 55 |
| Writeback failed | 0 |
| Deduplicated | 0 |
| Unknown | 0 |
| DB scanner signals written | 526 |
| Total runtime | 876.5s |

Result: Pass. `ranked + filtered + failed = 1000`, `unknown = 0`.

## Full-Scan With Analysis Proof

Production full-scan service shape uses the scanner-job container with:

- `python investment_scanner_mvp.py --run-analysis --timing --outdir /app/scanner_output`

The proof run used the same full mode in an isolated output folder:

- `python investment_scanner_mvp.py --run-analysis --timing --outdir /app/scanner_output/phase35c1_full_analysis`

Evidence:

- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/full-analysis-scanner-drop-reasons.json`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/full-analysis-scanner-drop-reasons.csv`
- `docs/ops/artifacts/phase-35-0c-1-scanner-persistence/production/full-analysis.log`

| Metric | Result |
| --- | ---: |
| Selected | 500 |
| Unique to scan | 500 |
| Accounted | 500 |
| Ranked | 346 |
| Filtered liquidity | 115 |
| Filtered market cap | 23 |
| Provider partial | 16 |
| Writeback failed | 0 |
| Unknown | 0 |
| DB scanner signals written | 346 |
| Analysis runtime | 4.9s |
| Total runtime | 317.0s |
| Exit 137 | No |
| Lock released | Yes |

Analysis details:

- Forward-return input signal rows: 346.
- Canonical signal rows: 346.
- Completed forward-return observations: 0, because this isolated proof folder had only one fresh snapshot.
- Signal lifecycle rows: 301.
- Signal lifecycle summary rows: 58.
- Analysis database rows written without OOM: `performance_summary=0`, `forward_returns=0`.

Result: Pass. Full scan with analysis completed without exit 137, orphan process, or host pressure.

## Memory Profile

Observed production `docker stats` samples:

| Run | Scanner memory observed | Container limit | Result |
| --- | ---: | ---: | --- |
| 500 fast proof | ~419 MiB peak observed | 4 GiB | Pass |
| 1000 fast proof | ~429 MiB peak observed | 4 GiB | Pass |
| Full-analysis proof | ~129 MiB early sample, completed successfully | 4 GiB | Pass |

No container restart, OOM kill, or orphan scanner-job container remained after the proof runs.

## Production Smoke After Scan

| Route | HTTP |
| --- | ---: |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/market-memory` | 200 |
| `/symbol/AMD` | 200 |
| `/alerts` | 200 |
| `/feed` | 200 |
| `/macro` | 200 |

## Root Cause Findings

| Finding | Evidence | Resolution |
| --- | --- | --- |
| Selected-vs-persisted gap had no terminal accounting | Prior runs showed selected symbols but fewer persisted signals | Every selected symbol now has a terminal scanner state and report row |
| Provider failures silently looked like persistence loss | Production failures included Yahoo DNS/connect errors for symbols such as `LUNR`, `SOUN`, `BITB`, `FBTC`, `ARKB`, `GBTC` | Symbols now end as provider/filter states instead of unknown |
| Filtered symbols were not visible in persistence accounting | 500 proof had 126 liquidity filters and 23 market-cap filters | Filtered states now appear in JSON/CSV and scan-run metadata |
| Manual and scheduled scans could overlap | Two scanner-job containers ran concurrently when outdirs differed | Shared root lock blocked the scheduled scan during manual proof |
| Full analysis could refresh too much historical market memory | Phase blocker reported exit 137 under analysis | Market-memory refresh is scoped to latest scan run; lifecycle rows are bounded |

## Remaining Non-Blocking Observations

- Provider DNS/connect failures remain noisy and slow. They are now explicitly accounted as provider/filter outcomes, but provider reliability is still an operational quality concern.
- The 500 fresh proof runtime was long because the proof output folder started with cold fundamentals/news cache. The 1000 and full-analysis runs used real warmed cache from the proof run to avoid repeated provider load.
- The isolated full-analysis proof had no completed forward-return windows because the folder contained only one fresh snapshot; it still exercised the analysis/writeback path and completed without exit 137.

## Final Certification Criteria

| Target | Result |
| --- | --- |
| 500 selected | Pass |
| 500 accounted | Pass |
| 500 unknown = 0 | Pass |
| 1000 selected | Pass |
| 1000 accounted | Pass |
| 1000 unknown = 0 | Pass |
| Full scan with analysis no exit 137 | Pass |
| No orphan process | Pass |
| No host pressure | Pass |
| Memory below configured ceiling | Pass |
| CPU bounded by scanner-job compose limit | Pass |
| Production smoke after scan | Pass |

Final verdict:

SCANNER PERSISTENCE AND FULL-SCAN STABILITY ACCOMPLISHED
