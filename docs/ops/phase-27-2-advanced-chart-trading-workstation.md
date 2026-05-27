# Phase 27.2 - Advanced Chart + Trading Decision Workstation

## Verdict

Status: Strong partial pending production deployment and production browser proof.

TradeVeto now exposes a source-bounded chart decision workstation inside the fullscreen chart flow. The implementation upgrades charts from an embedded visual into a richer decision environment with multi-panel layout controls, strategy zones, replay controls, capability disclosure, and honest advanced-overlay availability states.

This is not certified as full TradingView parity. Volume profile, session volume, anchored VWAP, and multi-symbol linked groups remain limited unless source-backed OHLCV and benchmark/compare series are available.

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

## Production Proof

Pending:

- Production pull.
- Production frontend/hot API rebuild.
- Production smoke.
- Production browser timing proof against `https://tradeveto.com/symbol/AMD`.
- Screenshot capture.

Expected artifact paths:

- `docs/ops/artifacts/phase-27-2-chart-workstation/browser-timing-chromium.json`
- `docs/ops/artifacts/phase-27-2-chart-workstation/browser-timing-mobile-chrome.json`
- `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-chromium.png`
- `docs/ops/artifacts/phase-27-2-chart-workstation/chart-workstation-mobile-chrome.png`
- `docs/ops/artifacts/phase-27-2-chart-workstation/playwright-report.json`

## Remaining Blockers

- Full anchored VWAP requires validated candle volume.
- Volume profile requires validated OHLCV and price-bucket logic backed by source volume.
- Session volume requires intraday OHLCV.
- Multi-symbol synced groups require source-backed compare-series and persisted linked-symbol workspace state.
- This phase does not implement a full TradingView/TrendSpider clone.
