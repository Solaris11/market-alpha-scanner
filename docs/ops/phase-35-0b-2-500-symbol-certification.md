# Phase 35.0B.2 - 500 Symbol Certification

Date: June 9, 2026

## Objective

Certify that TradeVeto production supports at least `500` symbols in the opportunity universe without critical scanner, discovery, symbol route, provider, database, memory, or route stability regression.

This phase validates the deployed 500-symbol production path. It does not certify the 1000-symbol phase for scheduled production cadence.

## Evidence Artifacts

Artifact folder:

`docs/ops/artifacts/phase-35-0b-2-500-symbol-certification/`

Included evidence:

- `production-scan-proof.json`
- `production-full-ranking-500.csv`
- `required-symbols-production.csv`
- `top-opportunities-production-500.csv`
- `opportunity-report.json`
- `performance-report.json`
- `route-smoke.csv`
- `route-latency-summary.json`
- `health.json`
- `health-deep.json`

## Production 500-Symbol Proof

Latest production scanner DB proof:

```text
500|369|362|2026-06-09 13:32:01.95933+00
```

Interpretation:

| Metric | Result |
|---|---:|
| Selected universe symbols | 500 |
| Symbols scored | 369 |
| Persisted scanner signals | 362 |
| Completed at | 2026-06-09 13:32:01 UTC |

This proves the production scanner is selecting the 500-symbol universe and persisting more than the prior 111-symbol compact universe.

## Required Opportunity Symbols

All required example symbols appeared in the latest production ranked output:

| Symbol | Decision | Action | Provider | Price Rows | Data Quality |
|---|---|---|---|---:|---:|
| RGTI | EXIT | STRONG SELL | alpaca | 505 | 100.0 |
| QBTS | EXIT | STRONG SELL | alpaca | 505 | 100.0 |
| QUBT | EXIT | STRONG SELL | yfinance | 500 | 65.0 |
| IONQ | EXIT | SELL | alpaca | 505 | 100.0 |
| LITE | EXIT | SELL | alpaca | 505 | 100.0 |
| RKLB | EXIT | SELL | alpaca | 505 | 100.0 |
| ASTS | EXIT | STRONG SELL | alpaca | 505 | 100.0 |
| LUNR | EXIT | STRONG SELL | yfinance | 500 | 65.0 |
| TEM | EXIT | STRONG SELL | yfinance | 496 | 65.0 |
| SOUN | EXIT | STRONG SELL | yfinance | 500 | 65.0 |
| HIMS | EXIT | STRONG SELL | yfinance | 500 | 65.0 |
| APP | AVOID | WAIT / HOLD | alpaca | 505 | 100.0 |
| PL | EXIT | STRONG SELL | yfinance | 500 | 65.0 |

No ranking, score, provider state, or decision was fabricated. These rows come from the copied production `full_ranking.csv`.

## Category Coverage

The 500-symbol universe includes the requested opportunity themes:

| Category | First 500 Count | Ranked Count |
|---|---:|---:|
| AI | 49 | 49 |
| Quantum | 9 | 9 |
| Crypto | 26 | 26 |
| Space | 17 | 17 |
| Defense | 25 | 25 |
| Biotech | 51 | 51 |
| Energy | 22 | 22 |
| Semiconductor | 30 | 30 |
| Growth | 128 | 128 |
| Momentum | 89 | 89 |
| Software, industry-derived | n/a | 45 |

Source-bucket coverage in the first 500:

| Bucket | Count |
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

## Opportunity Validation

Latest production output:

| Metric | Result |
|---|---:|
| Production ranked rows | 362 |
| Required symbols missing | 0 |
| Provider fallback rows | 182 |
| Stale rows | 59 |
| Low-confidence rows | 59 |
| Median final score | 48.4 |
| Max final score | 90.41 |

Top 10 production symbols by final score:

```text
UUP, MTB, LLY, EOG, MPC, PFG, BAC, ASB, MS, HLT
```

New opportunity names appear in scanner/discovery outputs as ranked rows, not as static symbol-list placeholders.

## Performance Comparison

Prior compact universe comparison:

| Run | Input | Ranked Rows | Total Runtime | Price Download | Scoring |
|---|---:|---:|---:|---:|---:|
| 111 core cold | 111 | 111 | 169.5s | 31.3s | 105.3s |
| 500 chunked cold | 500 | 362 | 210.1s | 41.4s | 158.1s |
| Production 500 warm-cache prior run | 500 | 362 | 254.7s | 86.4s | 132.0s |

Provider compatibility:

| Universe | Frames Returned | Errors | Elapsed |
|---|---:|---:|---:|
| 500 | 500 / 500 | 0 | 26.0s |
| 1000 | 1000 / 1000 | 0 | 48.2s |

Provider/cache proof:

- Production provider rows: `alpaca=180`, `yfinance=182`.
- Production primary provider rows: `alpaca=362`.
- Prior production warm-cache fundamentals: `369` hits, `0` misses.

## Route Smoke and Latency

Five production HTTPS samples were captured for each public route.

| Route | Status | p50 | p95 |
|---|---:|---:|---:|
| `/discover` | 200 | 249.88 ms | 263.57 ms |
| `/scanner` | 200 | 261.53 ms | 287.53 ms |
| `/symbol/AMD` | 200 | 500.97 ms | 530.31 ms |
| `/symbol/RGTI` | 200 | 364.42 ms | 413.07 ms |
| `/alerts` | 200 | 207.96 ms | 219.46 ms |
| `/feed` | 200 | 513.80 ms | 681.98 ms |
| `/macro` | 200 | 562.73 ms | 574.83 ms |
| `/market-memory` | 200 | 507.73 ms | 625.18 ms |

Public route regression result: pass.

Boundary:

- `/api/discovery` returned `401 Unauthorized` to unauthenticated probes.
- This phase therefore does not claim a new authenticated `/api/discovery` concurrency certification.
- Existing scale certification artifacts remain separate from this 500-symbol proof.

## Database and Resource Usage

DB table size snapshot:

| Table | Size |
|---|---:|
| `scanner_signals` | 2887 MB |
| `market_memory_snapshots` | 1087 MB |
| `symbol_price_history` | 122 MB |
| `scan_runs` | 8016 kB |

During-scan resource observation:

| Resource | Observation |
|---|---:|
| Scanner job CPU | 27.56% |
| Scanner job memory | 1.929 GiB / 2 GiB |

Post-scan resource snapshot:

| Container | Observation |
|---|---:|
| `market-alpha-frontend` | 161.9 MiB / 31.08 GiB |
| `market-alpha-frontend-hot-api` | 125.5 MiB / 31.08 GiB |
| `market-alpha-postgres` | 2.464 GiB / 31.08 GiB |
| Remaining scanner processes | 0 |

Interpretation:

- No scanner crash occurred.
- No orphaned scanner process remained after the production run.
- No frontend/hot-api memory runaway was observed.
- Scanner job memory peaked close to its `2 GiB` container limit; this is a watch item for the 1000-symbol scheduled-cadence phase, not a blocker for the completed 500-symbol proof.

## Health

Production health:

- `/api/health`: `ok`.
- `/api/health/deep`: app/db/scanner ok.
- Scanner freshness: updated approximately 4 minutes before capture.
- Backup status: warning due offsite R2 sync timeout; local backup ok. This is unrelated to the 500-symbol scanner certification but remains an operational issue outside this phase.

## Certification Boundary

Accomplished:

- 500-symbol production universe is deployed and selected.
- Production scanner completed with `500` selected symbols.
- `362` scanner rows were persisted.
- All required example opportunity symbols are ranked.
- Required opportunity categories are covered.
- Production scanner/discovery/symbol routes open without critical route regression.
- Provider price compatibility for 500 symbols has clean proof.
- No scanner orphan, container restart, or critical runtime memory exhaustion was observed.

Not claimed:

- New authenticated 25/50/100 concurrency certification.
- 1000-symbol scheduled production cadence.
- Full browser Core Web Vitals recertification.
- Real-user opportunity quality or retention impact.

## Final Verdict

`EXPANDED OPPORTUNITY UNIVERSE ACCOMPLISHED`
