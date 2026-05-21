# Phase 18.5 - Production Data Depth Completion

Date: 2026-05-21

## Objective

Reduce excessive limited-evidence, unavailable, insufficient-history, and shallow timeline states without fabricating market intelligence.

## Implemented Data-Depth Systems

### Scanner Signal Price Trail Fallback

- Added `frontend/src/lib/server/scanner-signal-price-history.ts`.
- When full `symbol_price_history` OHLC candles are missing, symbol and market chart systems can now fall back to real stored scanner signal price observations.
- Fallback packets are explicitly labeled `scanner_signal_price_history`.
- Symbol charts now disclose when they are using sparse scanner price observations instead of full OHLC candles.

### Market Memory Candidate Expansion

- `getMarketMemoryForSignal` now supplements `market_memory_snapshots` with historical `scanner_signals` rows.
- Supplemental candidates include real scan timestamps, setup type, sector, market regime, score bucket, decision state, verified event signatures, macro/event signatures, and linked `forward_returns` outcomes when available.
- Candidates are deduped by symbol, timestamp, setup type, and market regime.
- No analogs are invented; if historical scanner rows still do not match, the existing limited-memory state remains.

### Performance Lifecycle Population

- Performance now derives signal lifecycle rows from completed `forward_returns` evidence when the older lifecycle CSV artifact is absent.
- Derived lifecycle rows include symbol, signal date, horizon, completed return, status, drawdown/gain fields when present, and days-to-exit derived from the evidence horizon.
- Derived lifecycle summaries group by horizon, decision, and setup type so the Performance page has populated process-review context from stored outcomes.

### Replay and Symbol Timeline Depth

- Symbol signal history windows increased from 40 to 120 stored observations.
- History symbol coverage now scans 20 latest snapshots by default instead of 5.
- Strategy Labs payload depth increased from 220 to 520 historical simulated observations per mode.
- Visible closed strategy trades increased from 36 to 80.
- Portfolio allocation history checkpoints increased from 12 to 24.
- Strategy learning timeline checkpoints increased from 9 to 16.

## Data Rules Preserved

- No synthetic OHLC was created.
- Scanner signal price fallback is marked as sparse signal-evolution context.
- No fake Market Memory analogs were generated.
- Lifecycle rows are derived only from completed forward-return rows.
- Strategy history is deeper only when stored forward-return evidence exists.

## Local Validation

- `npm --prefix frontend run lint` - passed
- `npm --prefix frontend test -- --runInBand` - passed, 427 tests
- `npm --prefix frontend run build` - passed
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors
- `git diff --check` - passed

## Remaining Data Debt

- Continued depth depends on keeping production backfills and retention jobs healthy for full OHLC depth, market-memory snapshots, replay snapshots, paper trade lifecycle history, and long-term strategy revision history.
- Scanner signal price trails improve chart availability but are not a substitute for true candle history.
- Market Memory is deeper through historical scanner rows, but high-confidence analogs still require larger validated outcome coverage.
- Paper Trading depth still depends on real user paper events and portfolio history accumulation.
- Some long-tail symbols can still show limited states when there is no scanner, OHLC, memory, or forward-return evidence for that symbol.

## Production Validation

- Deployed commit: `1495446`
- Production frontend container: healthy
- `/api/health` - passed
- `/api/health/deep` - passed
- Production route smoke passed for `/`, `/terminal`, `/symbol/AMD`, `/history?symbol=AMD`, `/performance`, `/strategy-labs`, `/paper`, `/discover`, `/opportunities`, `/dashboard`, `/api/health`, and `/api/health/deep`.
- Production table depth checked:
  - `scanner_signals`: 315,925 rows
  - `market_memory_snapshots`: 315,925 rows
  - `forward_returns`: 113,109 rows
  - `symbol_price_history`: 113,005 rows
- AMD production depth checked:
  - scanner rows: 2,855
  - memory snapshots: 2,855
  - forward-return rows: 1,019
  - OHLC rows: 1,023

## Verdict

TRADEVETO DATA DEPTH COMPLETION ACCOMPLISHED
