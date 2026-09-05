# Scanner decision audit — why ENTER never fires

2026-09-05. Read-only audit against production data and the current code on
`work/autonomous-after-b177`.

## 1. The measured baseline

Production, last 7 days, 238,676 signal rows:

| final_decision | rows | share |
|---|---:|---:|
| EXIT | 126,079 | 52.82% |
| AVOID | 93,456 | 39.16% |
| WATCH | 15,379 | 6.44% |
| WAIT_PULLBACK | 3,634 | 1.52% |
| **ENTER** | **128** | **0.05%** |

774 ENTER rows have been produced in total since 2026-05-04. The most recent
was 2026-09-04 11:50 UTC.

**A correction to the framing.** The complaint was "the scanner says wait for
pullback too often". It does not: WAIT_PULLBACK is 1.5% of rows. What it
actually does is decline to decide — 92% of rows are EXIT or AVOID, and the
actionability text a trader reads on `/terminal` ("Watch only: Early; needs
confirmation") comes from a *different* layer than `final_decision`. Both
layers need looking at, and they fail differently.

## 2. The funnel, measured

67,949 rows over two days, each gate evaluated independently:

| Gate | Passing | Share |
|---|---:|---:|
| all rows | 67,949 | 100% |
| `risk_reward >= 1.0` | 45,693 | 67.2% |
| `entry_status` in GOOD ENTRY / BUY ZONE / NEAR ENTRY | 41,172 | 60.6% |
| **`setup_type != 'AVOID'`** | **7,513** | **11.1%** |
| **`recommendation_quality = 'TRADE_READY'`** | **1,289** | **1.90%** |
| **`final_score >= 80`** | **1,229** | **1.81%** |

ENTER requires all of these *simultaneously*, plus `confidence_score >= 70–82`
and `setup_strength >= 64–74`. The intersection is 0.05%.

## 3. Root causes, in order of how much they bind

### 3.1 The score floor sits above what the earlier gates leave behind

This is already established out-of-sample by
`docs/analysis/entry-score-threshold-holdout-study.md` (2026-09-02), and this
audit only confirms the mechanism is still live. Inside the real decision
cohort, after the setup, veto and confidence gates:

| | 5D | 10D | 20D |
|---|---:|---:|---:|
| ENTER under `>= 80` | **0** | **0** | **0** |
| ENTER under band 55–70 | 1,302 | 792 | 207 |

The zero is structural. And the band cohort returned +0.50% / **+1.35%** /
+0.88% with 56–61% hit rates, beating baseline in 8 of 9 walk-forward cells
where `>= 80` managed 3 of 9.

**That study's own recommendation is shadow mode, not a threshold edit**, and
its "not established" section is careful about why. This audit does not
override it.

### 3.2 `setup_type = "AVOID"` is a decision written into a classification field

`classify_setup` (`scanner/setup_engine.py:98-168`) returns
`Literal["PULLBACK","BREAKOUT","CONTINUATION","AVOID"]`. AVOID is not a setup
shape; it is a verdict. It arrives through four branches, the last of which is
the catch-all `else` at `:155-158` (`MIXED_SETUP_AVOIDED`), so it is the
*default* outcome — 89% of rows.

It is then counted twice. `setup_strength_for_type` caps AVOID at
`min(49.0, ...)` (`:186-187`), and that capped value re-enters
`recommendation_quality` as a **−25** penalty (`recommendation_quality.py:220-223`).
The same judgement suppresses the row once as a class and again as a score.

### 3.3 Every expansion feature is backward-looking

`score_breakout_quality` (`scanner/scoring.py:171-197`) is the only expansion
scorer. Its features:

| Feature | Looks |
|---|---|
| `last >= high_3m * 0.99` | backward — already at a 63-day high |
| `last >= high_1y * 0.96` | backward |
| `last > close[-21:-1].max()` | backward — the breakout has already printed |
| `Volume[-1] / Volume[-20:].mean() > 1.5` | backward — the spike already happened |
| proximity to the 1-year high | backward |

A grep across `scanner/` for `compression|coil|squeeze|nr7|inside_day|band_width`
returns **zero hits**. There is no narrowing-range, no volatility compression,
no volume build-up, no consolidation-duration term — nothing that fires *before*
a move.

Worse, it is self-cancelling: the same move that raises `breakout_score` also
pushes RSI past 74 and sets `entry_status = OVEREXTENDED`, which routes to
`BREAKOUT_REJECTED_EXTENDED` → AVOID (`setup_engine.py:138-140,274-279`). **The
scanner can only see expansion after it happens, and then rejects it for having
happened.** That is the owner's complaint, stated mechanically.

### 3.4 `trade_permitted` requires an empty veto list — a latent market-wide kill switch

`diagnostics.py:70`: `trade_permitted = final_decision == "ENTER" and not vetoes`.

`vetoes_for_row` (`:166-200`) appends `RISK_OFF_MARKET`, `BEAR_MARKET` or
`OVERHEATED_MARKET` from `market_regime` — a field identical for every symbol
in a scan. So in any non-neutral regime, every symbol carries a veto,
`trade_permitted` is False for all of them, and `engine.py:682-688` rewrites
every ENTER.

**This is not currently firing**: `market_regime` is NEUTRAL for 100% of the
last 7 days' rows. I checked rather than assumed, and the audit draft I started
from had this as the binding constraint — it is not. It is a landmine: the day
the tape turns risk-off, ENTER goes to zero market-wide by construction, and
the logs will say "veto" rather than "the market moved".

`HIGH_VOLATILITY` (ATR ≥ 7.0 or annualised ≥ 0.70) has the same effect while
being an advisory condition rather than a severe one.

### 3.5 The decision funnel is not instrumented

`ScannerAccounting` (`scanner/drop_reasons.py`) records why a symbol was dropped
during *selection and scoring*. It records nothing about the *decision* stage: a
symbol downgraded ENTER→AVOID at `engine.py:668` or ENTER→WATCH at `:675/698/704`
stays `state="ranked"`. Nothing counts which gate fired.

So the funnel that turns 238,676 rows into 128 ENTERs exists only offline, in a
one-off study. That is the first thing to fix, because everything else is
unmeasurable without it.

Two smaller holes: `mark()` silently no-ops when the symbol is not in its index
(`drop_reasons.py:93-95`), so a casing or alias mismatch loses the reason with
no warning — which is consistent with how SNDK vanished.

## 4. Baseline rubric score

Scored against the owner's rubric, on evidence, before any change.

| Criterion | Max | Score | Why |
|---|---:|---:|---|
| Timing | 2.0 | **0.3** | ENTER structurally zero after the gates; every expansion feature backward-looking; no pre-expansion detection; the high-score state self-cancels into OVEREXTENDED |
| Risk / reward | 1.5 | **1.1** | entry, stop, target and RR all computed; `RR < 1.0` vetoes; chase distance and OVEREXTENDED both exist and work |
| Evidence quality | 1.5 | **1.1** | volume, relative strength, trend, volatility and shock history all combined; data-quality flags and provider tracking present; catalyst integration is thin |
| False-positive control | 1.0 | **0.9** | very strong — arguably the only thing that is |
| Freshness | 1.0 | **0.3** | data freshness only (36h stale veto). No setup freshness: nothing separates "about to expand" from "expanded three weeks ago" |
| Explainability | 1.0 | **0.6** | `decision_reason`, reason codes and veto codes exist; the gate that actually eliminated the symbol is not recorded |
| Production robustness | 1.0 | **0.5** | scanner-job image 87 days stale; SNDK silently absent; `mark()` can no-op; tests and a real holdout study do exist |
| UI / terminal usefulness | 1.0 | **0.5** | terminal renders and the actionability text is now correct, but there is no ENTER lane because there is nothing to put in it |
| **Total** | **10.0** | **5.3** | |

## 5. Plan, in dependency order

1. **Instrument the decision funnel.** Per-symbol, per-gate: record which gate
   eliminated the row and with what margin. Zero behaviour change. Everything
   below is unmeasurable without it.
2. **Shadow-mode entry rule.** Make the entry threshold configurable — floor by
   default, band behind a flag — and evaluate both on every scan, persisting
   both decisions. Nothing user-visible changes. This is the holdout study's own
   proposal, unchanged.
3. **Pre-expansion features.** Compression, narrowing range, volume build-up,
   consolidation duration. Computed and persisted first, gating nothing, so
   their predictive value can be measured against forward returns before they
   influence a decision.
4. **Separate the setup class from the verdict**, and stop counting AVOID twice.
5. **Grade the vetoes.** Severe (stale, provider error, extreme volatility) must
   still block; advisory (high volatility, market regime) should reduce
   confidence, not empty the ENTER path market-wide.

Nothing in step 1 or 3 changes a decision. Steps 2, 4 and 5 do, and each needs
its own evidence before it goes live.
