# TradeVeto Calibration Report

Date: 2026-05-05

TradeVeto is a research and decision-support system. This report does not claim predictive certainty and should not be read as financial advice. The calibration goal is to reduce weak entries and overtrading, not to maximize trade frequency.

## 1. Current Algorithm Summary

The scanner uses a layered heuristic model:

1. Download price history and macro proxy data through yfinance.
2. Reject symbols with insufficient history, low price, low dollar volume, or equity market cap below the configured minimum.
3. Score technical structure, fundamentals, macro alignment, news, and risk.
4. Apply market-regime adjustments.
5. Evaluate recommendation quality, entry status, and risk/reward.
6. Convert the signal to a final decision: `ENTER`, `WAIT_PULLBACK`, `WATCH`, `AVOID`, or `EXIT`.

The current model is intentionally conservative in an overheated/weak-breadth market. The latest production scan produced no `ENTER` decisions.

## 2. Factor And Weight Table

| Factor | Indicator | Current Weight | Range | Purpose | Risk |
| --- | --- | ---: | --- | --- | --- |
| Trend | Price vs EMA20/SMA50/SMA200, EMA/SMA alignment, slopes | 26% of technical | 0-100 | Measures durable trend structure | Can double count momentum in strong trend regimes |
| SuperTrend | Direction, price vs SuperTrend line, recent flips | 16% of technical | 0-100 | Trend-following confirmation | Lagging indicator can be late after reversals |
| Momentum | RSI band, MACD histogram, 1M/3M returns | 20% of technical | 0-100 | Confirms current strength | Overbought names can score well before pullbacks |
| Breakout | 3M/1Y high proximity, 20D breakout, volume ratio | 18% of technical | 0-100 | Finds structural breakouts | Can reward extended entries |
| Relative volume | 1D and 5D volume vs 20D average | 10% of technical | 0-100 | Confirms attention/liquidity | Volume spikes can be event-driven noise |
| AVWAP | Price vs YTD and swing anchored VWAP | 10% of technical | 0-100 | Pullback/structure quality | Sensitive to anchor choice |
| Fundamental | Quality 40%, growth 35%, valuation 25% for equities | Equity composite 28% | 0-100 | Favors durable equity businesses | Sparse or stale fundamentals create false confidence |
| Macro | Asset/sector alignment with regime proxies | Equity 20%; ETF/bond/fx/commodity 35%; crypto 30% | 0-100 | Avoids fighting risk backdrop | Macro proxy selection can lag |
| News | Recent headline/event score | Equity/crypto 10%; ETF etc. 5% | 0-100 | Adds event awareness | News enrichment only runs for top names |
| Risk penalty | Volatility, ATR%, drawdown, overbought/fading, earnings | Subtracted from composite, cap 30 | 0-30 penalty | Reduces poor risk setups | Penalty can be duplicated later by quality gate |

Composite weights by asset type:

| Asset Type | Technical | Fundamental | News | Macro |
| --- | ---: | ---: | ---: | ---: |
| EQUITY | 0.42 | 0.28 | 0.10 | 0.20 |
| ETF / bond / FX / commodity proxies | 0.50 | 0.10 | 0.05 | 0.35 |
| CRYPTO / crypto proxy | 0.55 | 0.05 | 0.10 | 0.30 |
| Default | 0.45 | 0.20 | 0.10 | 0.25 |

## 3. Current Decision Rules

| Decision | Rule | Inputs | Risk | Improvement |
| --- | --- | --- | --- | --- |
| `EXIT` | Sell or strong sell action | Horizon action fields | May reflect horizon model rather than explicit position invalidation | Keep separate from new-entry logic |
| `AVOID` | Recommendation quality is `AVOID` | Entry status, risk/reward, regime, breadth, setup, score bucket | Latest scan has high-score names marked `AVOID`, which can confuse unless UI explains vetoes | Show veto/reason diagnostics |
| `WATCH` | Low edge, quality gate needs confirmation, missing entry zone, default no clean entry | Quality score, entry status, setup | Can become a catch-all state | Add reason codes and confidence |
| `WAIT_PULLBACK` | Strong setup but entry is extended or pullback needed | Quality, buy zone, entry distance | Correctly supports “best trade is no trade” | Preserve as first-class decision |
| `ENTER` | `TRADE_READY`, buy action, and entry status in good/buy-zone/near-entry | Quality, action, entry status | Could still enter if data is stale or volatility is extreme because those vetoes were not explicit diagnostics | Add veto diagnostics and future hard gate |

Known risk: some risk concepts are counted in both composite score and quality gate. This is conservative, but it can make score labels look stronger than final decisions.

## 4. Data Quality Findings

Latest production scan:

| Metric | Value |
| --- | ---: |
| Universe count | 111 |
| Scored symbols | 111 |
| Missing price/core score/risk fields | 0 |
| Negative risk/reward rows | 0 |
| Existing diagnostics in payload before this phase | 0 |
| Latest regime | OVERHEATED |
| Latest breadth | WEAK |
| Latest leadership | BALANCED |

Data quality gaps before this phase:

- Scanner signals did not carry explicit `data_provider`, `data_timestamp`, `history_days`, stale-data flags, missing-field lists, vetoes, or reason codes.
- Production DB rows had complete core numeric values, but calibration/debug consumers could not separate “good setup” from “good setup blocked by regime/entry/risk.”
- Provider failures are mostly filtered out before scoring, but rejected-symbol counts are not persisted with detailed reasons.

## 5. Forward Return Findings

Production DB sample at audit time:

- `scan_runs`: 80
- `scanner_signals`: 8,880
- `forward_returns`: 8,658
- Available horizons: 1D, 2D, 5D, 10D

Score bucket performance was not monotonic:

| Horizon | Best observed bucket | Notes |
| --- | --- | --- |
| 1D | 80+ had highest win rate, but negative average return and small sample | Short horizon noisy |
| 2D | 50-69 outperformed 70+ | Top scores did not dominate |
| 5D | 50-69 outperformed 70+ and 80+ | Pullback/quality matters more than high score |
| 10D | 50-59 had highest average return; 80+ sample was too small | Count < 30 for 80+ is low confidence |

Decision/action quality findings:

- Historical `BUY` outperformed `STRONG BUY` at 1D, 2D, and 5D in the current sample.
- `WATCH` often performed as well as or better than `ACTIONABLE` over 5D/10D.
- `AVOID` did not consistently underperform at 5D because many high-score names were avoided due to overheated/entry conditions, not structural weakness.
- `TRADE_READY` sample size was too small and weak at 1D/2D; it should not be used as proof of predictive power yet.

Setup findings:

- `pullback to AVWAP` was strongest over 5D.
- `trend continuation` was strongest over 10D.
- `breakout continuation` had small samples and weak short-horizon evidence.

Conclusion: the score is useful as a ranking/structure input, but not yet calibrated enough to justify more aggressive BUY thresholds.

## 6. Aggressiveness Analysis

Latest production scan:

| Final Decision | Count | Share |
| --- | ---: | ---: |
| ENTER | 0 | 0.0% |
| WAIT_PULLBACK | 2 | 1.8% |
| WATCH | 14 | 12.6% |
| AVOID | 55 | 49.5% |
| EXIT | 40 | 36.0% |

Target beta behavior:

- BUY/ENTER: 1-5% of universe only in favorable regimes.
- WATCH: 5-15%.
- WAIT/AVOID/EXIT: majority.

Assessment: current behavior is conservative, but appropriate for an `OVERHEATED` + weak-breadth market. Do not lower thresholds until more forward-return evidence exists.

## 7. Calibration Proposal

Recommended model direction:

1. Layer 1, Tradability Filter: enough history, liquidity, fresh data, no provider errors.
2. Layer 2, Risk Veto: stale data, low confidence data, high volatility, poor risk/reward, stop-risk, overheated/risk-off market.
3. Layer 3, Market Regime: preserve regime as a gating modifier, not just a score component.
4. Layer 4, Opportunity Score: trend, momentum, breakout/structure, volume, risk/reward.
5. Layer 5, Final Decision: `ENTER` only if score is strong, no veto is present, and confidence is sufficient.

Do not perform major weight tuning yet. The current forward-return evidence is too short and non-monotonic. The safest improvement is to make diagnostics explicit and gather a cleaner validation window.

## 8. Implemented Changes

This phase adds diagnostics to each scanner signal payload:

- `factor_scores`: trend, momentum, risk, volatility, breakout, volume, macro, fundamental, news, data_quality, recommendation_quality.
- `factor_weights`: composite score weights by asset type.
- `vetoes`: stale data, low confidence data, provider error, high/extreme volatility, poor risk/reward, overextended entry, stop risk, risk-off/overheated market.
- `confidence_score`: numeric 0-100 diagnostic confidence.
- `decision_reason_codes`: structured reasons for future explanation UI.
- `trade_permitted`: true only when final decision is `ENTER` and no vetoes exist.
- Data quality fields: provider, timestamp, history days, missing fields, stale-data flag, low-confidence flag, provider error, data quality score.

No core trading thresholds were loosened.

## 9. Remaining Limitations

- Forward-return sample is still small for 80+ scores and `TRADE_READY` decisions.
- Validation uses broad forward returns, not full trade-plan execution with entry/stop/target fills.
- Provider is still yfinance; this is adequate for beta research but not ideal for high-stakes market data.
- Rejected-symbol reason counts need first-class persistence.
- The final decision engine should eventually use `trade_permitted` or equivalent hard vetoes directly, after one validation window.

## 10. Recommended Next Validation Window

Run this diagnostic model for at least 20-30 full scanner runs before changing weights. Re-evaluate:

- Score monotonicity by horizon.
- `trade_permitted=true` forward returns.
- Vetoed high-score names vs non-vetoed high-score names.
- Pullback-to-AVWAP and trend-continuation setup performance.
- Decision distribution in risk-on, neutral, overheated, and risk-off regimes.
