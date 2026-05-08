# Phase 7.1 Market Memory Engine

TradeVeto Market Memory is the first Phase 7 layer that lets the product compare the current setup with historical scanner situations. It is designed as probabilistic research context, not prediction or financial advice.

## Architecture

- `scanner_signals` remains the source of raw saved scanner observations.
- `scan_runs` remains the source of run timestamps and regime-level metadata.
- `forward_returns` remains the source of outcome observations when available.
- `market_memory_snapshots` is a derived memory layer keyed one-to-one to `scanner_signals`.

Each memory snapshot stores:

- symbol and signal timestamp
- setup type, sector, regime, decision, score range
- confidence/readiness values when present in the scanner payload
- a compact setup signature
- forward-return outcome context by horizon when available

## Backfill

Historical memory can be backfilled from existing `scanner_output/history/scan_*.csv` files without running the full scanner:

```bash
tools/db/backfill_market_memory.py --history-dir scanner_output/history
tools/db/backfill_market_memory.py --history-dir scanner_output/history --apply --max-files 0
```

The script is intentionally idempotent:

- it reuses existing scan runs within a two-second timestamp match
- it creates `history_backfill` runs only when no matching run exists
- it uses a unique `source_file` index for backfilled runs
- it upserts scanner signals by `(scan_run_id, symbol)`
- it refreshes `market_memory_snapshots` after each imported snapshot

## Similarity Methodology

The v1 similarity score is deterministic and explainable. It gives weight to:

- setup type match
- regime match
- sector match
- score-range match
- decision-state match
- same-symbol memory
- final-score proximity

Only analogs above the similarity threshold are surfaced in the UI.

## Evidence Maturity

Evidence labels are intentionally conservative:

- High evidence confidence: 100+ comparable analogs
- Moderate evidence confidence: 30-99 comparable analogs
- Limited historical evidence: 1-29 comparable analogs
- No comparable memory yet: 0 analogs

All UI copy uses historical/probabilistic language.

## Current Limitations

- Similarity v1 is rules-based, not embedding-based.
- Outcome context depends on available forward-return rows.
- Intraday duplicate scans are useful for memory density, but the next iteration should add cluster de-duplication by trading day.
- Regime memory currently uses scanner regime fields and does not yet include macro liquidity or cross-asset context.
