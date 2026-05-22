# Phase 20.2 - Scanner Throughput + Discovery Speed

Final status: TRADEVETO SCANNER THROUGHPUT + DISCOVERY SPEED DOMINANCE ACCOMPLISHED

## Scope

Phase 20.2 targeted the production `/api/discovery` p95 regression reported in Phase 19.12 and the operational scanner workflow gaps around page-level search, dense scanner mode, rapid compare, saved scan presets, and keyboard-first discovery.

## Implementation Summary

- Added bounded `/api/discovery` request instrumentation with p50, p95, max, cache-hit rate, target status, cache status, and `Server-Timing` headers.
- Added a 20 second per-user discovery system hot cache on top of the existing base-row cache. The base-row cache was extended to 90 seconds, while the final system cache remains intentionally short so freshness is bounded.
- Optimized discovery query matching, sorting, grouping, latest timestamp lookup, and compare preset generation to reduce per-filter and per-sort work.
- Added a visible page-level search input with stable accessibility and test selectors: `data-discovery-search-input="true"`.
- Made keyboard search focus the hero search input instead of a lower duplicate input.
- Preserved scanner density, filter, sort, timeframe, shortlist, and compare state for fast reload workflows.
- Added sortable dense-table headers for symbol, performance/weakness, confidence, risk/crash, macro, replay, and freshness.
- Verified server-generated saved scan packs remain visible and instantly apply category filters from validated scanner rows.
- Expanded compare presets for expansion pressure, downside pressure, and replay confidence.

## Production Timing

Baseline from Phase 19.12 audit:

| Endpoint | Previous p95 |
| --- | ---: |
| `/api/discovery` | 1415 ms |

Production hot-path audit after deployment:

| Endpoint | Sample | p50 | p95 | Max | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `/api/discovery` | 30 authenticated premium requests | 66 ms | 117 ms | 131 ms | Pass |

Server-side timing headers during the same run reported `system-hit` with `Server-Timing` values generally between 2 ms and 5 ms. The external p95 includes network and response transfer time.

Raw timing artifact:

- `docs/ops/artifacts/phase-20-2-prod/discovery-timing-hot-path.json`

## Production Screenshots

Artifacts captured from production after deploy:

- `docs/ops/artifacts/phase-20-2-prod/discover-desktop-dense.png`
- `docs/ops/artifacts/phase-20-2-prod/discover-mobile-dense.png`
- `docs/ops/artifacts/phase-20-2-prod/screenshot-qa.json`

Screenshot QA confirmed:

| Check | Desktop | Mobile |
| --- | --- | --- |
| Page-level search present | Pass | Pass |
| Dense scanner mode active | Pass | Pass |
| Dense scanner table present | Pass | Pass |
| Hydration mismatch messages | None detected | None detected |

## Dense Scanner Proof

Dense mode now supports:

- compact rows with more visible symbols
- sortable scanner headers
- risk, confidence, macro, replay, freshness, and timeframe columns
- compare toggle per row
- shortlist toggle per row
- stable `data-discovery-scanner-table="true"` selector for QA

## Compare Workflow Proof

Rapid compare support now includes:

- momentum leaders
- risk escalation
- expansion pressure
- downside pressure
- money-flow leaders
- macro-supported names
- replay confidence
- sector clusters

The compare rail is generated from the current validated discovery universe and remains available from the same discovery workspace without route navigation.

## Saved Scan Proof

Server-generated saved scan packs are still emitted by the discovery system from validated scanner rows and render in the production discovery surface. User workflow state now persists scanner density, active quick filter, sort, timeframe, compare symbols, and shortlist symbols for fast reload.

Remaining maturity gap: custom named, account-level scan libraries are still lighter than Trade Ideas. The sprint target of fast reload, default scan packs, and persisted scanner workflow is met, but future work should add user-authored named server-side scans with sharing, folders, and alert binding.

## Production Validation

Local validation:

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 455 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |

Production validation:

| Check | Result |
| --- | --- |
| `git pull --ff-only origin main` on production | Pass |
| Frontend container rebuild/redeploy | Pass |
| Container health | Healthy |
| `/api/health` | 200 |
| `/api/health/deep` | 200 |
| `/terminal` | 200 |
| `/discover` | 200 |
| `/scanner` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/market-memory` | 200 |
| Authenticated `/api/discovery` timing audit | p95 117 ms |

## Remaining Gaps vs Finviz / Trade Ideas

- Trade Ideas still has deeper custom scan automation and alert-routing maturity.
- Finviz still has a simpler ultra-compact all-table mode for users who want pure spreadsheet density.
- TradeVeto now wins on intelligence context, cinematic scanner presentation, risk/replay/macro explainability, and hot-path API speed for the measured production path.

## Verdict

TRADEVETO SCANNER THROUGHPUT + DISCOVERY SPEED DOMINANCE ACCOMPLISHED
