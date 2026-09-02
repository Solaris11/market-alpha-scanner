# Entry Score Threshold — Holdout Study

Generated: 2026-09-02
Status: **analysis only.** No production behaviour was changed, no threshold was
edited, and nothing in this document has been deployed.

## 1. Question

The final decision layer requires `final_score >= 80` before a signal can become
`ENTER` (`scanner/engine.py`, `buy_score_threshold` default `80.0`). Production
currently emits no `ENTER` rows at all. This study asks two things against
matured forward returns:

1. How does the `>= 80` floor perform on data it was not tuned against?
2. How would a `55–70` band compare, on the same data?

It deliberately does **not** ask "how do we produce more ENTER rows". A gate that
admits more losing trades is worse than a gate that stays shut.

## 2. Data

Source: production Postgres, `forward_returns` joined to `scanner_signals` via
`forward_returns.scanner_signal_id` (the canonical link created by
`db/migrations/20260505_122500_forward_validation_linkage.sql`).

Export date: 2026-09-02. Signal-level fields come from `scanner_signals.payload`,
which stores the full scanner row.

| Horizon | Rows | Distinct symbols | Distinct signal dates | Range |
|---|---:|---:|---:|---|
| 5D | 158,151 | 372 | 98 | 2026-04-24 → 2026-08-13 |
| 10D | 112,005 | 369 | 90 | 2026-04-24 → 2026-07-23 |
| 20D | 29,059 | 354 | 40 | 2026-04-24 → 2026-07-22 |

**Units.** `forward_returns.return_pct` stores a fraction, not a percentage
(`scanner/analysis.py`: `return_pct = exit_price / base_price - 1.0`). Every
figure below is that value multiplied by 100. Reading the column name literally
would misstate every number by 100×.

### 2.1 Coverage gaps

| Horizon | Gap | Length |
|---|---|---:|
| 5D | 2026-07-23 → 2026-08-06 | 14 days |
| 10D | none | — |
| 20D | **2026-05-16 → 2026-07-04** | **49 days** |

The 20D gap is severe and is discussed in §9.

## 3. Split method

Calibration and holdout are separated strictly by `signal_date`:

- **Calibration**: `signal_date < 2026-07-01`
- **Holdout**: `signal_date >= 2026-07-01`

| Horizon | Calibration rows | Holdout rows |
|---|---:|---:|
| 5D | 119,611 | 38,540 |
| 10D | 90,194 | 21,811 |
| 20D | 23,632 | 5,427 |

The `55–70` band was **not** fitted on this data. It was specified in advance, so
the holdout numbers are a genuine out-of-sample test of a pre-committed rule
rather than a rediscovery of an in-sample optimum.

## 4. Reproducing this

Export on the production host (read-only):

```bash
cd /opt/apps/market-alpha-scanner/app
docker compose exec -T market-alpha-postgres \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > calibration-dated.csv <<'SQL'
\copy (SELECT ss.symbol, coalesce(ss.setup_type,'') AS setup_type,
              ss.payload->>'final_score'      AS final_score,
              ss.payload->>'confidence_score' AS confidence_score,
              ss.payload->>'setup_strength'   AS setup_strength,
              ss.payload->>'vetoes'           AS vetoes,
              fr.horizon, fr.signal_date, fr.return_pct
       FROM forward_returns fr
       JOIN scanner_signals ss ON ss.id = fr.scanner_signal_id
       WHERE fr.return_pct IS NOT NULL AND fr.horizon IN ('5D','10D','20D')
) TO STDOUT WITH CSV HEADER
SQL
```

Then run the study:

```bash
python3 tools/analysis/threshold_holdout_study.py \
  --csv calibration-dated.csv \
  --out docs/analysis/threshold-holdout-study.json
```

Full machine-readable output: `docs/analysis/threshold-holdout-study.json`.

## 5. Holdout results (all matured signals)

Returns in percent. `p10` is the 10th percentile — the shape of the bad tail.

### 5D

| Rule | n | Mean | Median | Hit | p10 |
|---|---:|---:|---:|---:|---:|
| baseline (every signal) | 38,540 | +0.36 | +0.44 | 54.5% | −7.30 |
| band 55–70 | 11,046 | +0.42 | +0.61 | 57.3% | −4.90 |
| production `>= 80` | 326 | **−0.24** | +0.07 | 58.9% | −3.60 |

### 10D

| Rule | n | Mean | Median | Hit | p10 |
|---|---:|---:|---:|---:|---:|
| baseline | 21,811 | +0.31 | +0.62 | 53.8% | −10.30 |
| band 55–70 | 6,120 | +0.67 | +0.92 | 58.1% | −6.96 |
| production `>= 80` | 174 | **−0.13** | −0.04 | 41.4% | −3.93 |

### 20D

| Rule | n | Mean | Median | Hit | p10 |
|---|---:|---:|---:|---:|---:|
| baseline | 5,427 | +0.14 | +1.04 | 54.9% | −14.74 |
| band 55–70 | 1,578 | +1.81 | +1.99 | 61.7% | −8.90 |
| production `>= 80` | 39 | **−0.42** | −0.87 | 25.6% | −1.73 |

Both candidate rules improve the bad tail (`p10`) relative to baseline, which is
what a risk-first gate is supposed to do. The `>= 80` floor has the tightest tail
of all — it is genuinely selective — but in this window that selectivity did not
translate into a positive mean.

### 5.1 Counter-evidence from the calibration window

`>= 80` was not uniformly poor. In the calibration window at 20D it returned
**+3.99% with a 79.8% hit rate** (n=297). The holdout reversal is therefore a
change in behaviour across two short windows, not a stable property established
over the whole record. This matters for how strongly §11 can be worded.

## 6. Dependence, and confidence intervals that respect it

These observations are **not independent**:

- One symbol contributes many rows (372 symbols, 158k rows at 5D — roughly 425
  rows per symbol).
- Signals on neighbouring dates share overlapping forward-return windows, so a
  single market move is counted repeatedly.

Treating rows as independent would make every interval far too narrow. Intervals
below come from a **clustered bootstrap** (2,000 resamples), resampling whole
clusters with replacement, computed two ways: clustering by **symbol** and,
separately, by **signal date**.

Difference in mean return versus baseline, holdout:

| Horizon | Rule | Point | CI95 (symbol clusters) | CI95 (date clusters) | P(diff > 0) |
|---|---|---:|---|---|---:|
| 5D | band 55–70 | +0.06 | [−0.36, +0.48] | [−0.27, +0.39] | 0.61 / 0.64 |
| 10D | band 55–70 | +0.36 | [−0.37, +1.04] | [−0.18, +0.90] | 0.83 / 0.91 |
| 20D | band 55–70 | **+1.67** | **[+0.47, +2.82]** | **[+1.09, +2.15]** | 0.997 / 1.00 |
| 5D | `>= 80` | −0.60 | [−1.69, +0.36] | — | 0.09 |
| 10D | `>= 80` | −0.44 | [−2.48, +1.46] | — | 0.28 |
| 20D | `>= 80` | −0.55 | [−2.02, +1.26] | — | 0.26 |

**Read this carefully.** The `>= 80` point estimate is negative at every horizon,
but every interval contains zero. With 326, 174 and 39 holdout observations there
is not enough data to call it harmful. What can be said is that it underperformed
the baseline in all three horizons in this window, and that nothing in this
holdout supports the threshold being where it is.

For the band, only 20D clears zero on both clusterings. 10D is suggestive; 5D is
indistinguishable from taking every signal.

## 7. Walk-forward

Expanding window: train on everything before the test month, evaluate on it. Mean
return, percent.

| Horizon | Month | baseline | band 55–70 | `>= 80` |
|---|---|---:|---:|---:|
| 5D | 2026-05 | +0.51 | +0.83 | +1.51 |
| 5D | 2026-06 | +0.44 | +0.72 | +0.33 |
| 5D | 2026-07 | +0.20 | +0.32 | −0.42 |
| 5D | 2026-08 | +2.20 | +1.43 | +1.31 |
| 10D | 2026-05 | +1.20 | +1.69 | −0.18 |
| 10D | 2026-06 | +0.69 | +0.99 | +0.48 |
| 10D | 2026-07 | +0.31 | +0.66 | −0.13 |
| 20D | 2026-05 | +3.43 | +3.83 | +2.94 |
| 20D | 2026-07 | +0.14 | +1.81 | −0.42 |

The band beats baseline in **8 of 9** month-horizon cells; it loses in 2026-08 at
5D, the smallest cell (n=1,007). `>= 80` beats baseline in **3 of 9** and is
erratic — best cell +1.51, worst −0.42.

20D has only two testable months because of the coverage gap.

## 8. The real decision cohort

The sections above measure the score in isolation. Production reaches the score
gate only after three earlier gates, so the numbers that matter operationally are
these. Order mirrors `scanner/engine.py`.

Holdout cohort:

| Stage | 5D | 10D | 20D |
|---|---:|---:|---:|
| matured signals | 38,540 | 21,811 | 5,427 |
| setup gate (`setup_type != AVOID`) | 3,159 | 1,828 | 488 |
| severe veto gate | 2,972 | 1,727 | 462 |
| confidence `>= 70` | 2,016 | 1,189 | 304 |
| **ENTER under `>= 80`** | **0** | **0** | **0** |
| **ENTER under band 55–70** | **1,302** | **792** | **207** |

Outcome of the band cohort:

| Horizon | n | Mean | Hit |
|---|---:|---:|---:|
| 5D | 1,302 | +0.50 | 55.8% |
| 10D | 792 | **+1.35** | 60.7% |
| 20D | 207 | +0.88 | 58.5% |

Two things follow.

**The zero is structural, not marginal.** After the setup, veto and confidence
gates, no surviving signal in the holdout scored 80 or above at any horizon. The
production symptom is fully explained: the score floor sits above the range that
the earlier gates leave behind.

**The earlier gates add value.** At 10D the band inside the decision cohort
returns +1.35% against +0.67% for the same band across all signals. Setup, veto
and confidence filtering roughly doubles the band's edge. Only the score floor
appears misplaced; the rest of the funnel is doing useful work.

## 9. The 20D coverage gap

20D carries no signals dated 2026-05-17 through 2026-07-03 — a 49-day hole. Its
calibration window is therefore roughly 2026-04-24 → 2026-05-16, and its holdout
2026-07-04 → 2026-07-22: two disjoint three-week episodes rather than two halves
of a continuous record.

Cause is **not established by this data**. Candidates worth checking:

- the analysis job that writes `forward_returns` did not run, or ran without the
  20D horizon, while those windows were maturing (development activity in the
  repository stops on 2026-06-09 and resumes 2026-08-06);
- gaps in `symbol_price_history` preventing the exit price lookup.

Settling it needs a separate query against `scan_runs`, `performance_summary` and
`symbol_price_history` around those dates. Until then, **20D conclusions carry
the least weight of the three**, despite having the tightest bootstrap interval —
that interval is computed inside a single three-week episode.

The 5D gap (2026-07-23 → 2026-08-06) is smaller but sits inside the holdout and
removes two weeks from it.

## 10. Look-ahead check

Forward returns should only exist for windows that have closed. Newest signal
dates trail the 2026-09-02 export by well more than each horizon:

| Horizon | Newest signal | Trading days to export | Window length |
|---|---|---:|---:|
| 5D | 2026-08-13 | ~14 | 5 |
| 10D | 2026-07-23 | ~29 | 10 |
| 20D | 2026-07-22 | ~30 | 20 |

No horizon carries signals too recent for its window to have closed, so the
returns are matured, not partial.

This rules out the coarse form of look-ahead. It does **not** rule out the finer
form: whether `final_score` at signal time was computed only from information
available at that time. That lives in the scanner's own scoring path and is not
observable from this export. It should be verified separately before any
threshold change is trusted.

## 11. Transaction costs

A round-trip cost applied uniformly. Holdout mean return, percent.

| Horizon | Rule | 0 bps | 5 bps | 10 bps | 25 bps |
|---|---|---:|---:|---:|---:|
| 5D | baseline | +0.36 | +0.31 | +0.26 | +0.11 |
| 5D | band | +0.42 | +0.37 | +0.32 | +0.17 |
| 5D | `>= 80` | −0.24 | −0.29 | −0.34 | −0.49 |
| 10D | baseline | +0.31 | +0.26 | +0.21 | +0.06 |
| 10D | band | +0.67 | +0.62 | +0.57 | +0.42 |
| 10D | `>= 80` | −0.13 | −0.18 | −0.23 | −0.38 |
| 20D | baseline | +0.14 | +0.09 | +0.04 | −0.11 |
| 20D | band | +1.81 | +1.76 | +1.71 | +1.56 |
| 20D | `>= 80` | −0.42 | −0.47 | −0.52 | −0.67 |

Cost bites hardest at 5D, where the edge is smallest to begin with: at 25 bps the
band's advantage over baseline is +0.06 percentage points, i.e. nothing. At 10D
and 20D the band's advantage survives every cost level tested.

Spread and slippage are **not** modelled separately here, and no liquidity filter
was applied beyond the scanner's own. A symbol-level spread estimate would make
these figures more honest and is the obvious next refinement.

## 12. What this does and does not establish

**Supported by the evidence:**

- After the setup, veto and confidence gates, no holdout signal reaches a score of
  80 at any horizon. The absence of `ENTER` in production is a structural
  consequence of where the floor sits, not a data problem.
- The `>= 80` floor underperformed the baseline in all three horizons in this
  holdout window, at every cost level tested.
- A pre-committed 55–70 band beat the baseline in 8 of 9 walk-forward cells and,
  inside the real decision cohort, would have produced 1,302 / 792 / 207 entries
  with positive mean returns and hit rates of 56–61%.
- The setup, veto and confidence gates improve outcomes and should be kept.

**Not established:**

- That `>= 80` is harmful. Clustered intervals for its underperformance include
  zero at every horizon, sample sizes are 39–326, and it performed well in the
  calibration window at 20D. "Underperformed in this holdout, and warrants
  investigation" is as far as the data goes.
- That the band's edge is real at 5D. The clustered interval spans zero and the
  advantage disappears under realistic costs.
- That any of this generalises beyond 2026-04 to 2026-08. That is one regime, and
  a distinctly weaker one in the holdout half (see §13).
- That `final_score` is free of subtle look-ahead (§10).

## 13. Regime

Holdout baselines are far below calibration baselines at every horizon:

| Horizon | Calibration baseline | Holdout baseline |
|---|---:|---:|
| 5D | +0.44 | +0.36 |
| 10D | +1.05 | +0.31 |
| 20D | +3.37 | +0.14 |

July–August was a materially weaker tape than April–June. This cuts both ways: it
makes the band's holdout outperformance more interesting, because it held up in a
worse market; and it means none of the absolute numbers here transfer to a
different regime. A rule tuned to five months of one market should be treated as
a hypothesis, not a setting.

## 14. Proposed next step: shadow mode, not a threshold edit

Given §12, replacing `80.0` with a band in the live decision path is not
justified yet. The proposal instead:

1. Make the entry rule configurable rather than a literal — a floor today, with a
   band available behind a flag (for example
   `TRADEVETO_ENTRY_SCORE_MODE=floor|band` plus bounds), defaulting to current
   behaviour so nothing changes on deploy.
2. In shadow mode, evaluate **both** rules on every scan and persist both
   decisions side by side, without changing what any user sees.
3. Let live observations accumulate until there are enough matured forward
   returns from the shadow rule to test it the way this document tests history.
4. Revisit with that evidence.

This keeps the user-visible decision logic unchanged while making the question
answerable with live data rather than a backfill.

## 15. Files

| File | Purpose |
|---|---|
| `tools/analysis/threshold_holdout_study.py` | The study; regenerates everything here |
| `docs/analysis/threshold-holdout-study.json` | Full machine-readable output |
| `tools/analysis/calibration_sweep.py` | Earlier threshold sweep that motivated this study |
