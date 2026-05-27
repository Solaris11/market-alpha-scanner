# Phase 27.2 - Advanced Chart + Trading Decision Workstation

## Verdict

Status: Strong partial accomplished.

TradeVeto now exposes a source-bounded chart decision workstation inside the fullscreen chart flow. The implementation upgrades charts from an embedded visual into a richer decision environment with multi-panel layout controls, strategy zones, replay controls, capability disclosure, and honest advanced-overlay availability states.

This is not certified as full TradingView parity or a fully passed performance certification. Volume profile, session volume, anchored VWAP, and multi-symbol linked groups remain limited unless source-backed OHLCV and benchmark/compare series are available. Production browser proof reaches the authenticated chart workstation and captures screenshots, but chart workspace restore still exceeds the proof budget.

## Implementation Summary

- Added a deterministic chart workstation model at `frontend/src/components/terminal/chart-decision-workstation.ts`.
- Added unit coverage for model capability disclosure, limited states, strategy-zone derivation, replay gating, and non-predictive decision copy.
- Added a fullscreen chart workstation panel inside `SymbolChartModal`.
- Added browser proof config and tests:
  - `frontend/playwright.phase27-2.config.ts`
  - `frontend/tests/phase27-2/chart-workstation.spec.ts`
- Added npm script:
  - `npm --prefix frontend run test:phase27:chart-workstation`

## Functional Coverage

Implemented:

- Split/grid/stack workstation layout controls.
- Existing synchronized timeframe persistence surfaced in the workstation.
- Existing synced crosshair support surfaced when multi-pane layouts are active.
- Strategy visualization from real scanner trade-level fields only.
- Risk/reward research box when entry, stop, and target are source-backed.
- Decision layer explaining:
  - why setup context exists
  - what invalidates it
  - what confirms it
  - why confidence changed
- Replay/playback panel gated by real replay or market-memory markers.
- Advanced overlay disclosure for:
  - anchored VWAP
  - volume profile
  - session volume
  - liquidity zones
  - ATR bands
  - relative strength
  - market regime
  - strategy zones
  - replay playback
  - decision layer

## No-Fabrication Boundaries

- Anchored VWAP remains limited for OHLC-only payloads.
- Volume profile remains limited without validated volume.
- Session volume remains limited without intraday OHLCV.
- Relative strength remains limited without a validated benchmark series.
- Multi-symbol linked groups remain limited until compare-symbol workspace state is source-backed and persisted.
- Replay playback remains limited without replay or market-memory markers.
- No predictive, guaranteed, direct buy/sell, or risk-free decision language is emitted.

## Local Validation

Completed:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend run test -- chart-decision-workstation.test.ts` - passed.
- `npm --prefix frontend run test:phase27:chart-workstation` - unit tests passed; browser proof skipped locally because local dev has no production-backed symbol chart data.
- `npm --prefix frontend test -- --runInBand` - passed.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors.
- `git diff --check` - passed.
- `node --check frontend/scripts/phase27-chart-workstation-browser-proof.mjs` - passed after proof timing refinement.

## Production Proof

Completed:

- Production runtime implementation deployed from `fe6040ed`.
- Production proof tooling deployed from `716e07c7` and timing refinement pulled at `befdd74`.
- Production frontend and hot API containers rebuilt after runtime implementation.
- Production smoke passed:
  - `/api/health` - 200
  - `/api/health/deep` - 200
  - `/terminal` - 200
  - `/discover` - 200
  - `/scanner` - 200
  - `/paper` - 200
  - `/strategy-labs` - 200
  - `/market-memory` - 200
  - `/symbol/AMD` - 200
  - `/alerts` - 200
  - `/feed` - 200
  - `/macro` - 200
- Authenticated production browser proof ran against `https://tradeveto.com/symbol/AMD` with a temporary premium probe user created through the production Postgres container and removed after each run.
- Screenshot proof captured at `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-chromium.png`.

Production browser proof artifacts:

- `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-browser-proof.json`
- `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-browser-proof-warm.json`
- `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-chromium.png`

Primary production browser proof:

- Overall status: `not_ready`
- Blocker: `workspaceRestoreMs 3371.242ms exceeds 3000ms budget`
- `workspaceRestoreMs`: 3371.242 ms
- `backgroundNetworkIdleMs`: 5762.54 ms
- `fullscreenOpenMs`: 158.96 ms
- `layoutSwitchMs`: 133.196 ms
- `replayScrubMs`: 33.48 ms
- Horizontal overflow: 0 px
- Decision layer: available
- Replay playback: available
- Research/no-financial-advice disclosure: present
- Unsupported predictive/direct-action claim check: passed

Warmed production browser proof:

- Overall status: `not_ready`
- Blocker: `workspaceRestoreMs 3791.408ms exceeds 3000ms budget`
- `workspaceRestoreMs`: 3791.408 ms
- `backgroundNetworkIdleMs`: 5858.005 ms
- `fullscreenOpenMs`: 184.657 ms
- `layoutSwitchMs`: 225.678 ms
- `replayScrubMs`: 8.616 ms
- Horizontal overflow: 0 px
- Decision layer: available
- Replay playback: available
- Research/no-financial-advice disclosure: present
- Unsupported predictive/direct-action claim check: passed

## Remaining Blockers

- Authenticated `/symbol/AMD` chart workspace restore is still above the 3000 ms proof budget in both production browser runs.
- Full anchored VWAP requires validated candle volume.
- Volume profile requires validated OHLCV and price-bucket logic backed by source volume.
- Session volume requires intraday OHLCV.
- Multi-symbol synced groups require source-backed compare-series and persisted linked-symbol workspace state.
- Mobile real-device chart workstation proof was not captured in this phase.
- This phase does not implement a full TradingView/TrendSpider clone.
