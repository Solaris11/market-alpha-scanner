# The score and the risk/reward measure the same distance with opposite signs

2026-09-06. Measured on production, 307,295 `scanner_signals` rows over nine
days (2026-08-28 → 2026-09-06). No forward returns are used or claimed here.

## The finding

`final_score` and `risk_reward` are strongly negatively correlated, every day,
without exception:

| Day | rows | corr(score, rr) | share rr ≥ 1.20 |
|---|---:|---:|---:|
| 2026-08-28 | 33,109 | −0.566 | 58.0% |
| 2026-08-29 | 34,130 | −0.483 | 57.9% |
| 2026-08-30 | 33,988 | −0.572 | 59.3% |
| 2026-08-31 | 33,852 | −0.571 | 60.5% |
| 2026-09-01 | 33,708 | −0.583 | 62.6% |
| 2026-09-02 | 33,753 | −0.594 | 62.9% |
| 2026-09-03 | 33,938 | −0.587 | 60.9% |
| 2026-09-04 | 33,915 | −0.568 | 60.8% |
| 2026-09-05 | 33,840 | −0.536 | 63.2% |

By score band, the relationship is monotonic across nine of nine buckets:

| score | rows | median rr | share rr ≥ 1.20 |
|---|---:|---:|---:|
| 0–10 | 2,820 | 9.90 | 100.0% |
| 10–20 | 13,625 | 6.33 | 99.7% |
| 20–30 | 23,220 | 4.57 | 97.0% |
| 30–40 | 43,383 | 3.92 | 81.7% |
| 40–50 | 67,868 | 2.92 | 74.3% |
| 50–60 | 61,068 | 1.33 | 54.2% |
| 60–70 | 57,968 | 0.89 | 36.4% |
| 70–80 | 30,878 | 0.53 | 19.9% |
| **80–87** | **4,459** | **0.38** | **4.6%** |

## Why, from the code rather than from the correlation

`scoring.py` line 982:

```python
take_profit_low = unique_resistances[0][0]      # nearest overhead resistance
risk_reward = (take_profit_low - current_price) / risk_per_share
```

The resistance candidates are the 3M high, the 6M high, the 1Y high and the
prior swing high. So `risk_reward` is *headroom to the next ceiling*, divided
by the distance to the stop.

`final_score` is composed from trend, momentum and breakout, all of which rise
as price approaches and clears those same highs.

They are therefore the same quantity — the distance between price and its
overhead resistance — entered into the model with opposite signs. Nothing
about markets is being discovered here; this is arithmetic in the scorer.

## Why this matters more than the four gate faults

The live ENTER gate requires `final_score >= 80`, and the setup thresholds
require `risk_reward` of 1.10 to 1.50. Measured together, those two conditions
are very nearly mutually exclusive:

```
score >= 80 over nine days          4,459 rows
    of which risk_reward >= 1.20      203 rows   (4.6%)
    of which at new highs               0 rows
```

**Zero.** Not one of the 4,459 highest-scoring rows in nine days was a clean
breakout with no resistance overhead. The scorer's fallback for that case
(`current_price + 2R to 3R`, giving a risk/reward of exactly 2.0) never fired
in the 80+ band. Every high-scoring row had a ceiling above it.

So the top of the ranking is not merely hard to enter. It is, by construction,
the part of the universe with the worst trade geometry — and the engine then
correctly refuses to trade it. Nine-day decision totals:

```
EXIT 162,301   AVOID 120,998   WATCH 18,723   WAIT_PULLBACK 5,145   ENTER 128
```

128 ENTERs in 307,295 rows, 0.042%.

**The engine's caution is protecting the user from the engine's own ranking.**
That reframes the remedy: the fix is not to lower the 80 floor, which would
simply admit more of the worst-geometry rows. It is to stop ranking by a
quantity the gate is guaranteed to reject.

## What this says about the candidate engine

The band rule (`candidate_decision.py`, 55–70 rather than a floor at 80) turns
out to be pointed at the right region for a reason the holdout study did not
state: 55–70 is where risk/reward is still achievable at all (36–54% of rows
clear 1.20) while the score is high enough to carry evidence. Above 70 it
collapses to 20%, then 4.6%.

Two honest limits on that claim:

- **The upper bound is now evidence-backed; the lower bound is not.** Nothing
  here shows that 55 is better than 45 or 60. Risk/reward is setup *geometry*,
  not outcome. Rows below 50 have excellent risk/reward largely because they
  are far from everything, which is not the same as having an edge. Only
  forward returns can place the lower bound, and this document does not
  contain any.
- **The candidate already uses the better variable.** The real discriminator
  is headroom, and `MIN_RISK_REWARD` enforces headroom-over-risk directly
  rather than through the score's proxy. No additional feature is needed; that
  is the reason none was added.

## Reproduction

```
tools/analysis/replay_candidate_decision.py     # real modules, real prod rows
docs/analysis/candidate-replay-20260906.txt     # 40-symbol stratified sample
```

The replay's ENTER counts are an **upper bound**: `scanner_signals` does not
persist `vetoes`, `confidence_score` or `setup_detail`, so the severe-veto
block and the confidence gate cannot fire during a replay. Both absences make
the candidate look more permissive on replay than it will be in production.
