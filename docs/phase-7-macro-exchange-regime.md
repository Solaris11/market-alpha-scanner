# Phase 7.3 Macro + Exchange Regime Engine

Phase 7.3 adds a bounded contextual decision-quality layer to the scanner. It does not replace the technical/setup score. The scanner now preserves the original score as `base_score` / `final_score_base`, then applies separate macro, exchange, sector, volatility, liquidity, and conflict adjustments to produce `final_score` / `macro_adjusted_score`.

## Methodology

The engine builds a first-generation market context from the latest scan universe:

- broad risk proxies: `SPY`, `QQQ`, `DIA`, `IWM`
- volatility proxies: `^VIX`, `VIX`, `VXX`, `UVXY`
- dollar/liquidity proxies: `DXY`, `UUP`
- rates proxies: `TLT`, `IEF`, `TNX`, `^TNX`
- theme proxies: `GLD`, `GDX`, `USO`, `OIL`, `XLE`, `BTC-USD`, `BTC`, `IBIT`
- symbol/theme baskets: semiconductor, software, financials, energy, crypto, gold/defensive

Every row receives:

- `macro_alignment_score`
- `exchange_health_score`
- `sector_alignment_score`
- `risk_on_score`
- `macro_pressure_score`
- `volatility_pressure`
- `liquidity_pressure`

## Bounded Adjustments

The final contextual adjustment is capped so macro context cannot dominate the scanner:

- macro alignment: max `+5 / -8`
- exchange context: max `+3 / -3`
- sector alignment: max `+4 / -4`
- volatility pressure: max `0 / -5`
- liquidity pressure: max `+2 / -5`
- macro conflict penalty: max `0 / -4`
- total contextual adjustment: max `+10 / -18`

Reason codes are emitted for explainability, including `MACRO_TAILWIND`, `MACRO_CONFLICT`, `EXCHANGE_TAILWIND`, `EXCHANGE_HEADWIND`, `SECTOR_SUPPORTIVE`, `SECTOR_PRESSURE`, `VOLATILITY_PRESSURE`, `LIQUIDITY_TIGHTENING`, and `MACRO_CONFLICT_PENALTY`.

## UI Surface

Symbol detail now shows both the base score and macro-adjusted contextual score inside the Macro + Exchange Context card. Terminal and opportunities cards expose compact macro context labels and adjustment deltas without turning them into deterministic market claims.

## Validation Helper

Use this without running a scanner job:

```bash
.venv/bin/python tools/compare_macro_context_adjustments.py \
  --csv scanner_output/full_ranking.csv \
  --regime-json scanner_output/analysis/market_regime.json
```

The script reports before/after score changes and reason codes for `NVDA`, `TSM`, `AMD`, `DDOG`, `OXY`, `SPY`, `QQQ`, `GLD`, `USO`, `BTC-USD`, `BTC`, and `IBIT`.

## Trust Rules

This layer is contextual and probabilistic. It must not be described as a macro forecast, trade recommendation, or deterministic prediction.
