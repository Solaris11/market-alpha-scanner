# Phase 35.0B.3 - 1000 Symbol Scale Certification

Date: 2026-06-09

## Objective

Validate that TradeVeto can support a 1000+ symbol opportunity universe without losing platform responsiveness or destabilizing production.

This certification is bounded to the scanner/universe expansion path, production scanner persistence, post-run route responsiveness, and opportunity coverage. It does not claim browser Core Web Vitals certification, authenticated Copilot deep-answer certification, or 100-concurrency API certification.

## Verdict

TRADEVETO EXPANDED OPPORTUNITY UNIVERSE ACCOMPLISHED

## Production Result

The 1000-symbol production scanner run completed successfully after two runtime changes:

- bounded price-history persistence for scanner writeback
- scanner-job memory ceiling increased from 2g to 4g

Production database proof:

| Metric | Value |
|---|---:|
| Universe count | 1000 |
| Symbols scored | 554 |
| Persisted scanner signals | 543 |
| Completed at UTC | 2026-06-09T14:31:03.750285+00:00 |

Successful run log:

- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-1000-scan-4g-bounded.log`

## Failure Sequence And Root Cause

The first certification attempts did not pass. This is included because it is the operational reason the final configuration matters.

| Attempt | Result | Evidence |
|---|---|---|
| 2g baseline | Failed with exit 137 after CSV output and before DB writeback | `production-1000-scan-failed-2g.log` |
| Streaming price-history writeback at 2g | Failed with exit 137 after CSV output and before DB writeback | `production-1000-scan-failed-streaming-2g.log` |
| Bounded price-history writeback at 2g | Failed with exit 137 after CSV output and before DB writeback | production proof JSON |
| Bounded price-history writeback at 4g | Passed DB writeback and released scanner lock | `production-1000-scan-4g-bounded.log` |

Root cause: the 1000-symbol scan could compute and write output, but the writeback path and scanner-job memory ceiling were not sufficient for production persistence at 2g. Streaming helped reduce batch pressure but did not solve the full process memory ceiling. Bounded recent-row persistence plus a 4g scanner-job ceiling completed the run.

## Runtime Measurements

| Universe | Environment | Total runtime | Price history | Scoring | Ranked rows | Notes |
|---:|---|---:|---:|---:|---:|---|
| 111 | Local cold | 169.5s | 31.3s | 105.3s | 111 | Core baseline |
| 500 | Local cold | 210.1s | 41.4s | 158.1s | 362 | Chunked provider path |
| 500 | Production warm cache | 254.7s | 86.4s | 132.0s | 362 | DB signals persisted |
| 1000 | Local cold | 703.0s | 178.6s | 484.4s | 545 | Chunked provider path |
| 1000 | Production 4g bounded | 588.1s | 179.7s | 360.5s | 543 | DB signals persisted |

Production 1000-symbol stage timings:

| Stage | Time |
|---|---:|
| Price history | 179.7s |
| Macro download | 4.4s |
| Scoring | 360.5s |
| Ranking table build | 3.5s |
| CSV writes | 1.1s |
| Total runtime | 588.1s |

## Resource Measurements

| Resource | Measurement |
|---|---:|
| Scanner-job memory peak observed | 3.621GiB / 4GiB |
| Scanner-job CPU peak observed | 100.74% |
| Post-run frontend memory | 203.7MiB / 31.08GiB |
| Post-run hot API memory | 129.2MiB / 31.08GiB |
| Post-run Postgres memory | 277.5MiB / 31.08GiB |
| Scanner process after run | No scanner process remained |

Memory remains a watch item. The 1000-symbol universe is certified only with the 4g scanner-job ceiling and bounded price-history persistence. It is not certified under the previous 2g limit.

## Provider, Cache, And Data Quality

| Metric | Value |
|---|---:|
| Primary provider rows | 543 alpaca primary |
| Alpaca direct rows | 204 |
| YFinance fallback rows | 339 |
| Fundamentals hits | 554 |
| Fundamentals misses | 0 |
| Event context cache | hit |
| Low confidence rows | 3 |
| Stale rows | 3 |

The run did not fabricate provider coverage. Rows using fallback provider paths are identified in the ranking output.

## Opportunity Coverage

Required emerging opportunity symbols all appeared in the ranked production output:

| Symbol | Ranked | Provider | Price rows | Final score | Decision |
|---|---|---|---:|---:|---|
| RGTI | Yes | alpaca | 506 | 23.76 | EXIT |
| QBTS | Yes | alpaca | 506 | 24.09 | EXIT |
| QUBT | Yes | yfinance fallback | 501 | 14.02 | EXIT |
| IONQ | Yes | alpaca | 506 | 31.75 | EXIT |
| LITE | Yes | alpaca | 506 | 44.89 | EXIT |
| RKLB | Yes | alpaca | 506 | 22.76 | EXIT |
| ASTS | Yes | alpaca | 506 | 24.46 | EXIT |
| LUNR | Yes | yfinance fallback | 501 | 21.65 | EXIT |
| TEM | Yes | yfinance fallback | 497 | 19.45 | EXIT |
| SOUN | Yes | yfinance fallback | 501 | 15.42 | EXIT |
| HIMS | Yes | yfinance fallback | 501 | 32.18 | EXIT |
| APP | Yes | alpaca | 506 | 55.24 | EXIT |
| PL | Yes | yfinance fallback | 501 | 21.35 | EXIT |

Coverage by category in the 1000-symbol universe:

| Category | Universe count | Ranked output count |
|---|---:|---:|
| AI | 49 | 46 |
| Quantum | 9 | 8 |
| Crypto | 26 | 22 |
| Space | 17 | 15 |
| Defense | 25 | 25 |
| Biotech | 51 | 45 |
| Energy | 22 | 22 |
| Semiconductor | 30 | 30 |
| Cloud | 20 | 20 |
| Cybersecurity | 6 | 6 |
| Growth | 128 | 117 |
| Momentum | 89 | 82 |

Opportunity coverage improved materially versus the 500-symbol proof:

- 500 production run: 362 persisted scanner signals
- 1000 production run: 543 persisted scanner signals
- Net increase: 181 additional ranked/persisted opportunities

## Production Route Smoke After 1000 Run

Routes remained available after the completed 1000-symbol run:

| Route | Status | Total time |
|---|---:|---:|
| `/api/health` | 200 | 122.65ms |
| `/api/health/deep` | 200 | 526.51ms |
| `/discover` | 200 | 189.01ms |
| `/scanner` | 200 | 306.83ms |
| `/symbol/AMD` | 200 | 423.02ms |
| `/symbol/RGTI` | 200 | 509.77ms |
| `/market-memory` | 200 | 533.42ms |
| `/feed` | 200 | 547.72ms |
| `/macro` | 200 | 495.73ms |

This proves production route availability after the 1000-symbol run. It does not replace full browser-performance certification.

## UX Surface Validation

| Surface | Evidence | Result |
|---|---|---|
| Discovery | `/discover` post-run smoke 200 in 189.01ms | Pass |
| Scanner | `/scanner` post-run smoke 200 in 306.83ms; DB persisted 543 signals | Pass |
| Market Memory | `/market-memory` post-run smoke 200 in 533.42ms | Pass |
| Symbol Research | `/symbol/AMD` and `/symbol/RGTI` post-run smoke 200 | Pass |
| Predictive Intelligence | Terminal route includes predictive system construction; no authenticated endpoint probe was executed | Bounded pass for page availability only |
| AI Copilot | Authenticated premium endpoint exists; no probe user credential was available for deep answer proof | Not claimed as deep-certified in this phase |

## Evidence Inventory

- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/performance-comparison-matrix.json`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/opportunity-report-1000.json`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-1000-proof.json`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-full-ranking-1000.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/required-symbols-production-1000.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/top-opportunities-production-1000.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/resource-snapshots.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/in-run-route-smoke.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/post-run-route-smoke.csv`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/health.json`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/health-deep.json`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-1000-scan-4g-bounded.log`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-1000-scan-failed-2g.log`
- `docs/ops/artifacts/phase-35-0b-3-1000-symbol-scale-certification/production-1000-scan-failed-streaming-2g.log`

## Certification Boundaries

Certified:

- 1000-symbol universe selection and scanner execution.
- 1000-symbol ranking output generation.
- 1000-symbol production DB persistence with 543 scanner signals.
- Required emerging opportunity symbols present in ranked output.
- Production route smoke remained green after the run.
- 500-to-1000 opportunity coverage increased without production instability.

Not certified by this artifact:

- 1000-symbol operation under the old 2g scanner-job memory limit.
- Browser Core Web Vitals for all routes.
- Authenticated Copilot deep-answer latency or quality.
- 100-concurrency API scale.
- Mobile real-device behavior.

## Remaining Watch Items

1. Reduce scanner persistence memory below the current 3.621GiB observed peak before increasing scanner cadence or moving beyond 1000 symbols.
2. Add an authenticated non-retention probe user for Copilot and predictive endpoint smoke that does not contaminate cohort analytics.
3. Continue provider coverage monitoring for fallback-heavy symbols.
4. Add scheduled comparison reports so 111/500/1000 deltas can be tracked over time.
