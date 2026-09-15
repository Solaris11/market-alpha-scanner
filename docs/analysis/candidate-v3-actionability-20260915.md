# P1-2 — Candidate v3: making the scanner actionable without making it reckless (2026-09-15)

Environment labels: **PROD HOST** = production box through the guarded relay
(Postgres, docker, systemd, journal); **PROD WEB** = https://tradeveto.com;
**LOCAL MAC** = repo, tests, replay analysis — never presented as production
evidence. `SCANNER_DECISION_MODE=current` throughout; nothing here changes a
live decision.

## 0. Decision block

| question | answer |
|---|---|
| is "we are missing opportunities" real? | **Yes, and it is measurable.** On matured production forward returns, the live engine's AVOID bucket is 82% of the non-sell universe and returns *exactly the baseline* (5D median +0.36% vs +0.37%, hit 54.5% vs 54.5%). An AVOID that carries no information is not risk management, it is abstention. |
| how much is being left on the table? | 557 symbol-days over 99 trading days clear the v3 entry rules. The live engine called **none** of them ENTER: 322 AVOID, 175 WATCH, 60 WAIT_PULLBACK. Those rows return 5D median +0.87% / hit 62.5%, 20D median +2.97% / hit 69.9%. |
| does v3 produce entries on a real market day? | **Yes.** PROD HOST run 15:47 UTC: `ENTER=4` (1 breakout, 3 band-core), `WAIT_PULLBACK=25`, 29 actionable of 352 rows, **29/29 WHERE-complete**. 26 of those 29 are AVOID in the live engine today. |
| is it better than the baseline, not just bigger? | Yes on every axis the acceptance criteria name: higher median at 5D/10D/20D, higher hit rate, and a *better* p10 tail (-4.55% against the baseline's -5.29% at 5D). |
| should the live default flip? | **Not yet, and not in one commit.** v3 has no matured forward returns *of its own* — the replay is a reconstruction on historical rows, which is evidence but not the same thing. §8 proposes a conservative and an aggressive rollout; both need your approval. |
| what stays live today | `current`. v3 writes `candidate_v3_*` columns only, in every mode. |

## 1. The measurement: what the live engine is abstaining from

Dataset: every `scanner_signals` row with a matured 5D forward return, non-SELL
action, final score 40-100, deduplicated to **one row per symbol per day**
(a scan runs every 15 minutes, so undeduplicated counts would be ~26x
correlated). 13,372 symbol-days, 329 symbols, 2026-05-05 to 2026-09-09.
Relay bundle `v3_dataset`; analysis on LOCAL MAC.

Baseline for that pool: 5D mean +0.42% / median +0.37% / hit 54.5% / p10 -5.29%;
10D median +0.58% / hit 54.6% / p10 -8.07%; 20D median +1.55% / hit 59.0%.

| live decision | rows | share | 5D median | 5D hit | 10D median | 20D median |
|---|---:|---:|---:|---:|---:|---:|
| AVOID | 11,018 | 82.4% | +0.36% | 54.5% | +0.54% | +1.77% |
| WATCH | 1,954 | 14.6% | +0.45% | 54.6% | +0.73% | +0.25% |
| WAIT_PULLBACK | 398 | 3.0% | +0.42% | 55.3% | +0.77% | +0.28% |
| ENTER | 2 | 0.01% | — | — | — | — |

Two readings, both uncomfortable. The engine's dominant verdict is
indistinguishable from doing nothing, and its actionable verdict is
statistically absent.

## 2. What actually predicts, and what only looks like it does

Cohorts on the same deduplicated pool (LOCAL MAC over PROD HOST rows):

| cohort | rows | 5D median | 5D hit | 5D p10 | 10D median | 20D median |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 13,372 | +0.37% | 54.5% | -5.29% | +0.58% | +1.55% |
| buy action & enterable location | 2,877 | +0.54% | 57.1% | -4.09% | +0.86% | +1.44% |
| + live `setup_type != AVOID` | 670 | +0.44% | 55.7% | -4.47% | +0.75% | +1.02% |
| nearest-resistance rr ≥ 1.5 (on the above) | 263 | **-0.11%** | **48.7%** | -4.58% | -0.25% | +0.53% |
| balanced rr ≥ 1.5 (on the above) | 482 | +0.45% | 55.6% | -4.52% | +0.54% | +1.61% |
| breakout numeric triple (brk≥72, vol≥65, mom≥68) | 483 | +0.95% | 63.4% | -6.18% | +1.35% | +8.82% |
| score ≥ 80 with every other gate passed | **4** | — | — | — | — | — |

Four things fall out of that table, and each is a fault rather than a threshold:

1. **The live score floor of 80 is not selective, it is empty.** Four matured
   rows in four months. The band where the edge lives is 55-70.
2. **Nearest-resistance risk/reward is anti-predictive.** Requiring rr ≥ 1.5
   *lowers* the hit rate to 48.7%, below a coin flip and below the unfiltered
   pool. It is nevertheless a severe veto in the live engine (POOR_RISK_REWARD
   appears on 88 of 352 rows in a typical run). The balanced-target number is
   the honest one.
3. **`setup_type != AVOID` costs sample without adding edge** (n falls 2,877 →
   670, hit rate falls 57.1% → 55.7%). It is a verdict wearing a
   classification's clothes; v3 derives a *shape* instead.
4. **The breakout cohort is the best one in the study and the live engine
   produces zero of them**, because relative volume is computed on the partial
   current bar: on PROD HOST the median relative-volume score reads **24.6 live
   against 51.7 on the last completed bar**. Intraday, every breakout looks
   volumeless.

## 3. The grid

288 parameter cells (confidence 60/65/70/75 × score band 45-85/50-75/55-70/55-75/60-80
× balanced rr 0/1.2/1.5 × setup gate none/live/shape), each scored on 5D and 10D
median, hit rate, p10 tail, sample size, WHERE-completeness and concentration.
Selection rule: best risk-adjusted actionable profile inside 0.5-3.0% of the
fresh universe — explicitly *not* the largest ENTER count.

The winning region is stable rather than a single lucky cell: every top-10 cell
has confidence ≥ 75 and the 55-70 band, and differs only in the rr floor and the
setup gate. Chosen cell: **confidence ≥ 75, score 55-70, classified shape,
balanced rr ≥ 1.5** — 242 rows, 2.44/day, 5D median +0.74% / hit 56.6% /
p10 -4.13%, 10D median +0.99% / hit 59.9%, 20D median +1.40%.

Ablations from that cell (what each gate is worth):

| change | rows | 5D median | 5D hit | 10D median |
|---|---:|---:|---:|---:|
| chosen cell | 242 | +0.74% | 56.6% | +0.99% |
| drop the confidence gate | 1,403 | +0.41% | 53.9% | +0.85% |
| drop the score band | 570 | +0.70% | 59.8% | +0.75% |
| drop the shape gate | 344 | +0.53% | 57.0% | +1.03% |
| drop the buy-action gate | 628 | +0.54% | 56.8% | +1.28% |

The confidence gate is the load-bearing one; the band pays at 10D; the shape
gate is roughly neutral on returns and is kept because it is what lets the
output say *what kind of setup* this is.

## 4. Candidate v3

Two ENTER paths, deliberately different in kind:

**CORE** — buy action, enterable location, classified shape, raw confidence ≥ 75,
score inside 55-70, balanced rr ≥ 1.5, WHERE-complete.

**BREAKOUT** — buy action, enterable location, breakout ≥ 72, **completed-bar**
relative volume ≥ 55, momentum ≥ 60, WHERE-complete. No confidence gate and no
band: adding a confidence floor to this path cut it from 316 to 77 rows and
turned the 10D median negative (-0.10%). The breakout path earns its place by
being *unlike* the core path, not by being a stricter version of it.

| path | rows | /day | 5D median | 5D hit | 5D p10 | 10D median | 10D hit | 20D median | 20D hit |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORE | 242 | 2.44 | +0.74% | 56.6% | -4.13% | +0.99% | 59.9% | +1.40% | 62.3% |
| BREAKOUT | 316 | 3.19 | +0.90% | 66.8% | -4.78% | +1.04% | 60.1% | +5.74% | 76.0% |
| **union (v3 ENTER)** | **557** | **5.63** | **+0.87%** | **62.5%** | **-4.55%** | **+0.99%** | **60.0%** | **+2.97%** | **69.9%** |
| baseline | 13,372 | 135.1 | +0.37% | 54.5% | -5.29% | +0.58% | 54.6% | +1.55% | 59.0% |

4.17% of the non-sell pool; 100% WHERE-complete; largest sector share 24%,
largest single-symbol share 3.8%.

**WAIT_PULLBACK** — price has run past the entry (OVEREXTENDED / WAIT PULLBACK),
the shape is real, a zone, a stop and a target exist, balanced rr ≥ 1.2. This is
where most of the live engine's AVOID verdicts belong: "this is worth owning,
but not here, and here is the level where it becomes tradable again."
Forward returns from the *signal* date understate this path by construction
(the trade is not taken at the signal), so it is sized by usefulness and
capped by evidence rather than tuned on return: 20D median +2.22% / hit 61.4%
is consistent with "wait, then it works", and is not used as a promotion
argument.

**Everything else**: `NO_ENTRY` for a sell signal on a symbol nobody holds
(EXIT is an instruction to a holder — see §7), `AVOID` only for a severe data or
risk block, `WATCH` for everything that is merely not ready, each with the
specific gate it failed in `candidate_v3_reason_codes`.

Severity is split as the product needs it: STALE_DATA, PROVIDER_ERROR,
EXTREME_VOLATILITY and STOP_RISK block; HIGH_VOLATILITY, OVEREXTENDED_ENTRY and
the nearest-resistance POOR_RISK_REWARD cost 4 confidence points each (capped at
12) and move ranking, never the entry. POOR_RISK_REWARD is re-decided on the
balanced target and is severe only when that number is bad too.

WHICH is answered by `candidate_v3_actionability_rank` (entries first, breakout
ahead of band-core on equal size because its replay hit rate is 66.8% against
56.6%, then waits) and `candidate_v3_capital_rank_reason`, which states that
reason in words on every row.

## 5. First production runs (PROD HOST)

Deploy: commits `a82a7328` (engine), `5d84b2c0` (parser fix), `9b1840f6`
(target ladder), each pushed through the relay, pulled on prod, image rebuilt
with rollback tags `rollback-scanner-20260915-pre-v3`, `-v3-step1`,
`-v3-ladder`.

The first live run returned **zero** actionable rows, and the cause is worth
recording: production writes level ranges as `318.58-323.99` with no spaces, and
the signed number pattern in the v3 parser read that hyphen as a minus, so every
entry zone came out as `(-323.99, 318.58)` and failed WHERE-completeness — which
both actionable paths require. Unsigned parsing plus a positive-level check
fixed it; three tests now pin the hyphenated, spaced and currency-prefixed
spellings. The lesson is the one the replay cannot teach: a rule that cannot
read its own inputs produces the same silence as a rule that is too strict.

Run 15:47 UTC, 352 rows, on the fixed image:

```
[scanner] candidate_v3 rows=352 WAIT_PULLBACK=25 AVOID=68 WATCH=97 ENTER=4 NO_ENTRY=158
          | actionable=29 where_complete=29 | enter_breakout=1 enter_core=3
[perf] total_runtime took 343.7s        (previous run on the old image: 344.0s)
```

ENTER is 1.1% of the universe, inside the 0.5-3.0% target. Runtime is unchanged;
the stage itself costs 45 ms for 352 rows. Of the 29 actionable rows, **26 are
AVOID in the live engine** and 3 are WATCH.

Top of the actionable list (PROD HOST, `v3_actionable`):

| # | symbol | v3 | path | current | entry zone | stop | targets | conf | rr |
|---|---|---|---|---|---|---|---|---|---|
| 1 | EXPD | ENTER | BREAKOUT | AVOID | 187.06-189.31 | 182.68 | 194.23 / 208.03 / 213.09 | 61 | 1.50 |
| 2 | DHR | ENTER | CORE | WATCH | 205.05-208.25 | 200.43 | 219.98 / 220.66 / 223.89 | 85 | 1.50 |
| 3 | A | ENTER | CORE | WATCH | 147.35-150.23 | 141.92 | 163.23 / 163.55 / 167.87 | 76 | 1.50 |
| 4 | EXEL | ENTER | CORE | WATCH | 54.76-55.65 | 53.49 | 58.90 / 59.72 / 59.98 | 77 | 1.50 |
| 5 | CVX | WAIT_PULLBACK | — | AVOID | 205.98-208.88 | 200.02 | 217.50 / 240.44 / 248.52 | 55 | 1.50 |
| 6 | XOM | WAIT_PULLBACK | — | AVOID | 161.13-163.62 | 154.25 | 174.08 / 191.23 / 198.62 | 55 | 1.50 |

EXPD is the case the breakout fix was written for: breakout 93, momentum 89, and
a completed-bar volume of 61 where the live partial-bar number would have
disqualified it. CVX and XOM are the energy rally the live engine calls AVOID;
v3 says *wait for 205.98-208.88* and *wait for 161.13-163.62*, with the
invalidation and the confirmation spelled out on the row.

Every one of the 25 WAIT rows carries a pullback zone, a confirmation sentence
("take the entry when price trades back into X-Y and holds it on a close;
abandon it if price closes below Z first") and an invalidation level.

## 6. Acceptance criteria

| criterion | result |
|---|---|
| v3 ENTER > 0 on a fresh run, or a convincing market-condition explanation | **4** on the 15:47 UTC run (1 breakout, 3 core) |
| ENTER + WAIT meaningful (15-40 per run) | **29** |
| 100% of ENTER rows WHERE-complete | **4/4**, and 29/29 including waits |
| 100% of WAIT rows give pullback zone / confirmation / invalidation | **25/25** |
| replay: 5D and 10D median better than baseline | +0.87% vs +0.37%; +0.99% vs +0.58% |
| replay: hit rate better than baseline | 62.5% vs 54.5% (5D); 60.0% vs 54.6% (10D) |
| replay: p10 tail not meaningfully worse | **better**: -4.55% vs -5.29% (5D), -7.49% vs -8.07% (10D) |
| more trader-useful WHAT / WHERE / WHICH than current | current: one line of AVOID text. v3: decision, path, shape, zone, stop, three targets, invalidation, confirmation, rank and the reason capital should prefer it |
| scanner runtime not worse | 343.7s against 344.0s; the stage costs 45 ms |

## 7. SELL is not EXIT (product / copy item, no code change here)

`final_decision.py` maps any SELL composite action straight to EXIT, and 58-62%
of rows carry one. For a user who does not hold the symbol, "EXIT" is not an
instruction, it is noise — and it is the single largest bucket on the board.
v3 labels those rows `NO_ENTRY` with the sentence "EXIT applies only to an open
position in this symbol". Adopting that distinction in the product means: EXIT
shown only where a paper-trading or watchlist position exists, `NO_ENTRY`
elsewhere, and the 158-row bucket relabelled accordingly. That is a frontend copy
and decision-semantics change, listed here and deliberately not made in this
commit.

## 8. Rollout options (both need your approval)

**Option A — conservative (recommended).** `current` stays the live default and
nothing on the existing board changes. `/terminal` gains a separate
"Actionable opportunities (early edge)" panel fed by the `candidate_v3_*`
columns, clearly labelled as research-stage output with its own disclaimer, and
carrying WHAT / WHERE / WHICH per row. The user sees the 29 candidates today
instead of an empty ENTER board, and the live engine's conservatism is
unchanged. Risk: two decision voices on one screen; mitigated by labelling and
by keeping the WAIT-first framing.

**Option B — aggressive.** `SCANNER_DECISION_MODE=candidate_v3` in a controlled
window (one week, market hours, with the rollback tag ready and a daily check of
ENTER count, WHERE-completeness and severe-veto cleanliness). This makes v3 the
board. It should not happen before v3 has **its own** matured forward returns:
the first 5D maturities from today's rows land ~2026-09-22 and 10D ~2026-09-29.

Recommended sequence: Option A now, collect v3's own forward returns for 10
trading days, then decide on B with the same acceptance gates applied to real
v3 rows rather than reconstructed ones.

## 9. What is still open

- **v3 has no matured returns of its own.** Everything in §2-§4 is a
  reconstruction over historical rows. It is the strongest evidence available
  before a deploy, and it is not the same as the thing itself.
- **`pre_expansion_score` could not be validated.** No row with matured returns
  carries the field, so v3 treats it as a ranking bonus and never a gate. Any
  threshold on it today would be unevidenced.
- **Sector concentration on a trending day.** Today's actionable list is 13 of
  29 in Energy (45%), against a 24% maximum in the replay. All 13 are WAIT
  rather than ENTER, so no capital is implied, but a per-sector cap on the
  published list is the obvious next guard.
- **WAIT_PULLBACK cannot be scored honestly on signal-date forward returns.**
  Measuring it properly needs zone-touch tracking (did price return to the zone,
  and what happened from there), which the lifecycle tables could support.
- **The `rr` column is 1.50 on nearly every row** because the balanced target is
  constructed as a 1.5R level. It still discriminates (the ≥1.5 gate cuts the
  core cohort by 30%), but it should not be read as a per-symbol reward estimate;
  the target ladder is the honest reward statement.
