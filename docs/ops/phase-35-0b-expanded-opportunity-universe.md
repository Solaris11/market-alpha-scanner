# Phase 35.0B - Expanded Opportunity Universe

Date: June 9, 2026

## Objective

Expand TradeVeto from the compact `111` symbol scanner universe to a broader opportunity universe while preserving production safety.

## Implementation Summary

- Added `scanner/universe.py` with built-in `core`, `500`, and `1000` universe selectors.
- Added `scanner/data/opportunity_universe_1000.csv` with exactly `1000` unique symbols.
- Preserved the original `111` symbol universe as `core`.
- Added all required opportunity symbols:
  - `RGTI`, `QBTS`, `QUBT`, `IONQ`, `LITE`, `RKLB`, `ASTS`, `LUNR`, `TEM`, `SOUN`, `HIMS`, `APP`, `PL`.
- Added CLI support:
  - `--universe-size core`
  - `--universe-size 500`
  - `--universe-size 1000`
- Kept explicit `--symbols` and `--universe-csv` behavior unchanged.
- Updated `market-alpha-scanner-job` to default to `500` symbols through:
  - `TRADEVETO_SCANNER_UNIVERSE_SIZE`
  - command default `${TRADEVETO_SCANNER_UNIVERSE_SIZE:-500}`
- Added yfinance large-universe chunking at `125` symbols per provider request.

## Universe Source

The expanded CSV is ordered as:

1. Existing compact core universe.
2. Required opportunity names.
3. Curated thematic opportunity names across AI, quantum, crypto proxies, space, defense, biotech, growth, momentum, mid-cap, and emerging leaders.
4. Source-listed common-stock filler from NasdaqTrader symbol directories.

The generated CSV excludes known yfinance-incompatible or stale symbols observed during proof runs:

- `SQ`
- `CYBR`
- `INFA`
- `LLAP`
- `CFLT`
- `BPMC`
- `SPR`
- `SWTX`
- `BITF`
- `MAXR`
- `POCI`

## Universe Composition

Artifact: `docs/ops/artifacts/phase-35-0b-expanded-universe/universe-summary.json`

| Universe | Input Symbols | Unique | Required Opportunity Symbols |
|---|---:|---:|---|
| `core` | 111 | 111 | Only `APP` was already in core |
| `500` | 500 | 500 | All required symbols included |
| `1000` | 1000 | 1000 | All required symbols included |

1000-symbol source category counts:

| Category | Count |
|---|---:|
| core | 111 |
| required_opportunity | 12 |
| ai | 25 |
| quantum | 4 |
| crypto_proxies | 21 |
| space | 10 |
| defense | 17 |
| biotech | 38 |
| growth | 23 |
| momentum_midcap | 32 |
| emerging_leaders | 3 |
| nasdaqtrader_nasdaq | 399 |
| nasdaqtrader_otherlisted | 305 |

## Provider Compatibility

Artifact: `docs/ops/artifacts/phase-35-0b-expanded-universe/provider-compatibility-checks.csv`

| Universe | Symbols Checked | Frames Returned | Errors | Elapsed |
|---|---:|---:|---:|---:|
| 500 | 500 | 500 | 0 | 26.0s |
| 1000 | 1000 | 1000 | 0 | 48.2s |

## Scanner Performance Comparison

Environment:

- Local repo virtualenv.
- `DATABASE_URL` unset.
- `--fast`.
- `--no-save-history`.
- News enrichment skipped.
- Forward-return analysis skipped.
- yfinance chunk size: `125`.

Artifact: `docs/ops/artifacts/phase-35-0b-expanded-universe/performance-comparison.json`

| Run | Input | Ranked Rows | Price Download | Scoring | Total Runtime | Fundamentals Misses | Sampled RSS |
|---|---:|---:|---:|---:|---:|---:|---:|
| 111 core cold | 111 | 111 | 31.3s | 105.3s | 169.5s | 111 | Not sampled |
| 500 chunked cold | 500 | 362 | 41.4s | 158.1s | 210.1s | 368 | ~304 MB |
| 1000 chunked cold | 1000 | 545 | 178.6s | 484.4s | 703.0s | 555 | ~284 MB |

## Performance Interpretation

500-symbol rollout is acceptable for the scheduled scanner job:

- Total scanner runtime rose from `169.5s` to `210.1s`.
- Provider price check returned `500/500` frames with `0` errors.
- Memory remained bounded in sampled local runs.
- Existing scanner-job container guardrails remain in place:
  - `cpus: "1.5"`
  - `mem_limit: 2g`

1000-symbol Phase 2 is implemented and full-scan proven, but should remain a manual selector until production cadence is explicitly approved:

- Full 1000-symbol cold scanner runtime was `703.0s`.
- Provider compatibility was clean at `1000/1000` frames and `0` errors.
- Memory remained bounded in sampled local runs.
- The main bottleneck is cold fundamentals/provider scoring latency, not local memory runaway.

## Opportunity Quality

Artifacts:

- `docs/ops/artifacts/phase-35-0b-expanded-universe/opportunity-quality-500.json`
- `docs/ops/artifacts/phase-35-0b-expanded-universe/opportunity-quality-1000.json`
- `docs/ops/artifacts/phase-35-0b-expanded-universe/required-symbols-ranked-500.csv`
- `docs/ops/artifacts/phase-35-0b-expanded-universe/required-symbols-ranked-1000.csv`
- `docs/ops/artifacts/phase-35-0b-expanded-universe/top-candidates-500.csv`
- `docs/ops/artifacts/phase-35-0b-expanded-universe/top-candidates-1000.csv`

500-symbol ranked output:

- Ranked rows after scanner quality filters: `362`.
- Required opportunity symbols ranked: all 13.

1000-symbol ranked output:

- Ranked rows after scanner quality filters: `545`.
- Required opportunity symbols ranked: all 13.

The scanner continues to filter by real provider data, price, liquidity, and market-cap constraints. No scanner scores, rankings, provider data, or company rows were fabricated.

## Validation

Focused validation passed:

- `.venv/bin/python -m unittest tests.test_expanded_universe`
- `.venv/bin/python -m unittest tests.test_market_data_provider.MarketDataProviderTests.test_yfinance_large_downloads_are_chunked`
- CLI smoke:
  - `.venv/bin/python investment_scanner_mvp.py --universe-size 500 --symbols AMD --skip-news --skip-analysis --no-save-history --timing --outdir /tmp/tradeveto_phase35b_cli_smoke`

Known unrelated validation issue:

- `.venv/bin/python -m unittest tests.test_market_data_provider` currently fails an existing assertion in `test_fallback_reduces_data_quality_without_provider_error_veto`: expected `95.0`, actual `91.0`.
- That failure is unrelated to the universe expansion and was not introduced by this phase.

## Certification Boundary

Accomplished:

- 500-symbol built-in universe.
- 1000-symbol built-in universe.
- Required opportunity symbols included.
- Thematic opportunity categories represented.
- yfinance large-universe provider chunking.
- 500-symbol scheduled scanner default with environment rollback.
- Provider compatibility proof for 500 and 1000.
- Full scanner proof for 500 and 1000.

Not claimed:

- 1000-symbol scheduled production cadence.
- No-regression claim for 1000 under production schedule.
- Browser scanner row proof; this phase expands backend scanner universe, not the scanner UI virtualization proof.

## Final Verdict

EXPANDED OPPORTUNITY UNIVERSE ACCOMPLISHED
