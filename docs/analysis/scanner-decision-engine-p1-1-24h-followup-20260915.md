# P1-1 — 24-hour autonomous follow-up: fresh-market shadow window, STALE_DATA proof, BREAKOUT=0, replay evidence

Window: 2026-09-14 13:41 UTC → 2026-09-15 ~13:40 UTC. Continues
`scanner-decision-engine-p1-1-evidence-20260914.md` (the 09-14 report). Labels:
**PROD HOST** (relay → prod box: Postgres, scan journal, docker/systemd),
**PROD WEB** (in-app browser on tradeveto.com), **LOCAL MAC** (code, tests).
`SCANNER_DECISION_MODE=current` throughout; nothing in this window changed a
live decision.

## 0. Running decision block (updated 09:30 UTC 09-15; final wording after the 12:20 UTC pre-open test)

| question | answer |
|---|---|
| should `current` stay the live default? | **Yes.** `SCANNER_DECISION_MODE=current` throughout; nothing in this window changed a live *decision rule*. Two live *data-integrity* fixes shipped (the midnight NaN bar, the full-scan lock wait) — they correct inputs, not verdicts. |
| how ready is the candidate? | **v1 (deployed candidate): not a switch candidate** — 0 ENTER on 40+ fresh runs; it inherits the SELL action, the severe-veto list and the −25 quality verdict. **v2 (shadow, `candidate_v2_*`): promising but unproven** — 1–4 ENTER and 15–26 WAIT_PULLBACK per fresh run, every one with zone/stop/target, and its rules are the ones the replay favours (§5: band, balanced-target rr, class-not-verdict). It has ~20 hours of fresh rows and **no matured forward returns of its own**. |
| is the stale gate a bug? | **Yes, proven four ways (weekday pre-open case closed 12:02 UTC 09-15: wall-clock 196/352, market-calendar 0/352, v1 candidate ENTER 1 → 0, v2 held).** (a) Wall-clock `STALE_DATA` 99.4% of rows on weekend/holiday/Monday-pre-open days, 3.4% on weekdays (§3 of the 09-14 report); (b) per run: 354/356 wall-clock vs **0/356** market-calendar on Monday pre-open with Friday bars (§2); (c) the 00:47/01:17 runs after the NaN fix: 246/197 wall-clock vs 0 market-calendar on a bar the provider had not re-published yet (§4e). The 12:20 UTC weekday pre-open reading will close the last case. |
| what evidence is missing for a live rollout? | (1) v2 ENTER/WAIT rows joined to matured 5D/10D/20D `forward_returns` — first 5D maturities land ~09-21, 10D ~09-28; (2) the `pre_expansion ≥ 45` gate has **no** matured cohort at all (§5 J) — v2 records `band_ok` so its cost can be measured; (3) the volume artefact fix at the scoring layer (completed-bar features are persisted, not yet consumed); (4) a market-calendar freshness test in the live veto path (shadow `mcal_*` is persisted and correct). |
| next safe step | Keep `current`. Promote, in this order and each as its own measured deploy: (1) market-calendar freshness into the live severe list (the `mcal_*` shadow is the implementation; expected effect: Monday/holiday/pre-open universes stop reading as 100% AVOID); (2) completed-bar volume features into `classify_setup`'s breakout branch and the risk/reward target-band rule into the live rr (both shadow-measured, replay-backed); (3) only then judge `SCANNER_DECISION_MODE=candidate` (v2 rules) against ≥10 trading days of its own matured forward returns, on a dry-run outdir first. |

## 1. PROD HOST — per-run monitoring log (fresh-market window)

Source: relay `prod_db_read --query run_history` (one row per `scan_runs`
row; `stale` = rows carrying the wall-clock `STALE_DATA` veto, `mkt_stale` =
rows where `stale_by_market_calendar` is true, `mcal_severe` = rows whose
market-calendar shadow veto list still contains a severe code).

| run | at (UTC) | rows | live E/W/Wa/A/X | setup A/P/C/B | STALE | mkt_stale | other severe | mcal severe | v1 E/W/Wa/A/X | v2 E/W/Wa/A | v2 band_ok | v2 WHERE-complete | conf≥70 | note |
|---|---|---:|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---|
| df085435 | 09-14 13:16 | 356 | 0/1/40/108/207 | 355/1/0/0 | 354 | 0 | 130 | — | 0/0/1/148/207 | — | — | — | 1 | pre-open, Friday bars |
| 560cb56b | 09-14 13:31 | 356 | 0/3/39/108/206 | 343/13/0/0 | 291 | 0 | 130 | — | 0/0/12/138/206 | — | — | — | 7 | first partial bars arriving |
| 4984a236 | 09-14 13:47 | 355 | 0/10/31/89/225 | 297/57/1/0 | **0** | 0 | 142 | — | 0/0/51/79/225 | — | — | — | 30 | **first fresh run** |
| e761abcc | 09-14 14:02 | 355 | 0/14/29/92/220 | 292/62/1/0 | 0 | 0 | 139 | 139 | 1/0/53/81/220 | **3/20/62/50** | 6 | **23/23** | 27 | first run with `mcal_*` and `candidate_v2_*` |
| 2c1b2412 | 09-14 14:17 | 356 | 0/12/27/97/220 | 295/59/2/0 | 0 | 0 | 139 | 139 | 1/0/47/88/220 | 2/20/58/56 | 7 | 22/22 | 28 | |
| 81cd9582 | 09-14 14:32 | 356 | 0/12/28/93/223 | 301/54/1/0 | 0 | 0 | 140 | 140 | 2/0/48/83/223 | 4/19/59/51 | 8 | 23/23 | 27 | |
| 2f48180a | 09-14 14:49 | 356 | 0/9/27/97/223 | 300/55/1/0 | 0 | 0 | 138 | 138 | 2/0/44/87/223 | 4/19/57/53 | 9 | 23/23 | 26 | 15:00 check-in: v2 ENTER = ARGX, SAIC, TMO, KO; live still 0 |
| b448e5da | 09-14 15:08 | 354 | 0/9/28/97/220 | 303/50/1/0 | 0 | 0 | 147 | 147 | 3/0/44/87/220 | 4/15/57/58 | 7 | 19/19 | 26 | |
| 937fb49a | 09-14 15:16 | 354 | 0/8/27/101/218 | 305/48/1/0 | 0 | 0 | 141 | 141 | 3/0/43/90/218 | 3/18/59/56 | 6 | 21/21 | 22 | |
| b6938bf7 | 09-14 15:31 | 354 | 0/8/31/98/217 | 300/53/1/0 | 0 | 0 | 150 | 150 | 3/0/48/86/217 | 3/21/56/57 | 8 | 24/24 | 27 | |
| 4bd97e56 | 09-14 15:46 | 354 | 0/10/31/104/209 | 299/54/1/0 | 0 | 0 | 146 | 146 | 3/0/51/91/209 | 4/22/62/57 | 9 | 26/26 | 32 | |
| 86c03895 | 09-14 16:03 | 352 | 0/10/30/105/207 | 297/54/1/0 | 0 | 0 | 146 | 146 | 3/0/47/95/207 | 4/23/61/57 | 11 | 27/27 | 33 | |
| 000fb2e1 | 09-14 16:16 | 352 | 0/10/32/104/206 | 295/57/0/0 | 0 | 0 | 143 | 143 | 3/0/54/89/206 | 4/19/67/56 | 11 | 23/23 | 33 | 16:30 check-in: mid-session relvol median 31.0 (partial-bar artefact live: overnight ~48), breakout median 1.2, numeric breakout triple 0 |
| c17bf0d8 | 09-14 16:31 | 352 | 0/7/31/113/201 | 297/55/0/0 | 0 | 0 | 149 | 149 | 3/0/43/105/201 | 3/22/60/66 | 11 | 25/25 | 31 | |
| 165d0380 | 09-14 16:46 | 352 | 0/7/32/115/198 | 296/56/0/0 | 0 | 0 | 151 | 151 | 3/0/45/106/198 | 3/24/62/65 | 10 | 27/27 | 31 | |
| 510cecb4 | 09-14 17:01 | 352 | 0/9/39/107/197 | 295/56/1/0 | 0 | 0 | 157 | 157 | 2/0/47/106/197 | 2/26/68/59 | 8 | 28/28 | 29 | |
| 9e504aff | 09-14 17:16 | 352 | 0/9/31/113/199 | 296/55/1/0 | 0 | 0 | 154 | 154 | 2/0/45/106/199 | 2/23/68/60 | 8 | 25/25 | 30 | |
| d7cae37a | 09-14 17:32 | 352 | 0/9/30/112/201 | 296/55/1/0 | 0 | 0 | 154 | 154 | 2/0/42/107/201 | 2/25/63/61 | 7 | 27/27 | 31 | |
| e140281c | 09-14 17:47 | 352 | 0/6/29/117/200 | 298/52/2/0 | 0 | 0 | 154 | 154 | 2/0/44/106/200 | 2/26/63/61 | 9 | 28/28 | 32 | 18:00 check-in: v2 ENTER = ARGX, KO (live says WAIT_PULLBACK for both); TMO/SAIC left the band intraday |
| a5b194f1 | 09-14 18:01 | 352 | 0/13/27/112/200 | 294/56/2/0 | 0 | 0 | 153 | 153 | 2/0/42/108/200 | 2/24/62/64 | 7 | 26/26 | 33 | |
| a319927c | 09-14 18:16 | 352 | 0/11/28/113/200 | 296/55/1/0 | 0 | 0 | 152 | 152 | 3/0/41/108/200 | 3/26/58/65 | 8 | 29/29 | 32 | first run with completed-bar fields |
| 1d1af41d | 09-14 18:31 | 352 | 0/10/29/113/200 | 296/55/1/0 | 0 | 0 | 155 | 155 | 3/0/42/107/200 | 3/25/63/61 | 9 | 28/28 | 32 | |
| 393f43de | 09-14 18:46 | 352 | 0/10/29/114/199 | 296/55/1/0 | 0 | 0 | 152 | 152 | 3/0/43/107/199 | 3/24/65/61 | 8 | 27/27 | 33 | |
| 5aa3055d | 09-14 19:02 | 352 | 0/11/27/116/198 | 297/55/0/0 | 0 | 0 | 146 | 146 | 1/1/43/109/198 | 1/22/67/64 | 7 | 23/23 | 33 | |
| 91018e84 | 09-14 19:16 | 352 | 0/11/30/114/197 | 296/56/0/0 | 0 | 0 | 149 | 149 | 1/1/45/108/197 | 1/21/67/66 | 7 | 22/22 | 33 | |
| cd3438ed | 09-14 19:31 | 352 | 0/9/29/117/197 | 297/54/1/0 | 0 | 0 | 149 | 149 | 2/1/44/108/197 | 2/24/66/63 | 9 | 26/26 | 31 | 19:45 check-in |
| de24b41d | 09-14 19:47 | 352 | 0/11/25/122/194 | 299/52/1/0 | 0 | 0 | 149 | 149 | 2/1/45/110/194 | 2/26/70/60 | 7 | 28/28 | 34 | |
| be770a12 | 09-14 20:01 | 352 | 0/13/27/117/195 | 301/51/0/0 | 0 | 0 | 147 | 147 | 1/0/44/112/195 | 2/22/69/64 | 7 | 24/24 | 36 | last in-session run; relvol live 47.2 vs completed 46.3 |
| 95c7e981…149795b2 | 09-14 20:16 → 21:47 (7 runs) | 352 | 0/12/27/119/194 | 305/47/0/0 | 0 | 0 | 150 | 150 | 1/0/45/112/194 | 1/24/71–73/60–62 | 6 | 25/25 | 33–34 | post-close: rows static; `last_bar_partial` 352 → 196 (21:01, straddles the close) → 0; relvol live = completed = 51.5 |
| b81d64fb | 09-14 23:47 | 352 | 0/13/27/118/194 | 304/48/0/0 | 0 | 0 | 149 | 149 | 1/0/46/111/194 | 1/24/72/61 | 6 | 25/25 | 35 | end-of-day canonical row for forward_returns; v2 ENTER = KO |
| 47a69156 / … | 09-15 00:02, 00:16 | 352 | 0/6/14/87/245 → 0/…/258 | 327/25/0/0 | 0 | 0 | 139 | 139 | 0/0/31/76/245 | 0/19/52/36 | 1 | 19/19 | 22 → 18 | **midnight NaN-bar corruption (§4e)** |
| (00:31) | 09-15 00:31 | 352 | 0/…/115/203 | — | 0 | 0 | — | — | — | 3/21/…/… | — | — | 39 | first run with the NaN-bar fix |
| (00:47, 01:17) | 09-15 | 352 | 0/7/48/91/206 → 0/11/23/115/203 | — | **246 → 197** (wall-clock, Friday bar after the NaN drop) | 0 | — | — | — | 2/19 → 3/21 | — | — | 27 → 39 | NaN window, now reading as freshness |
| (01:48 → 03:47, 5 runs) | 09-15 | 352 | 0/22/24/113/193 | — | 0 | 0 | — | — | — | **4/24** | — | — | **80** | Monday bar re-published; steady overnight state |

(E=ENTER, W=WAIT_PULLBACK, Wa=WATCH, A=AVOID, X=EXIT.)

Snapshot of the first fresh run (`run_snapshot`, 4984a236): composite_action
STRONG SELL 136 / SELL 89 / WAIT-HOLD 85 / BUY 33 / STRONG BUY 12;
recommendation_quality AVOID 306 / LOW_EDGE 25 / WAIT_PULLBACK 24 /
TRADE_READY 0; entry_status BUY ZONE 102 / NEAR ENTRY 123 / OVEREXTENDED 91 /
STOP RISK 39; vetoes POOR_RISK_REWARD 77, OVEREXTENDED_ENTRY 91,
HIGH_VOLATILITY 51, STOP_RISK 39, EXTREME_VOLATILITY 31, STALE_DATA 0,
LOW_CONFIDENCE_DATA 0; candidate reasons SELL_SIGNAL 225, SEVERE_VETO 75,
NO_SETUP_FORMING 38, NO_BUY_SIGNAL 12, LOW_QUALITY 2, POOR_RISK_REWARD 2,
LOW_CONFIDENCE 1; breakout_score ≥72: 12, with volume ≥65 and momentum ≥68:
**0**; relative_volume median 43 → the open-hour partial bar (§4).

## 2. PROD HOST — STALE_DATA is a wall clock: proven per run

Deployed 12:46 UTC (commit `079fa6fa`, rollback tag
`rollback-scanner-20260914-p11-step1`): `stale_by_market_calendar` and
`missed_sessions`, observation only. Deployed 13:47 UTC (`d94920e0`, tag
`rollback-scanner-20260914-p11-step2`): `mcal_vetoes`, `mcal_severe_vetoes`,
`mcal_data_quality_score` — the live veto list re-run with the calendar test
in place of the wall clock, nothing downstream reads them.

| state | run(s) | wall-clock STALE_DATA | market-calendar stale | severe data vetoes forced |
|---|---|---:|---:|---|
| Monday pre-open, Friday bars (12:56–13:16 UTC) | d51736cb, df085435 | 354 / 356 | **0 / 356** | 354 STALE_DATA + 299 LOW_CONFIDENCE_DATA → setup AVOID 355, confidence < 50 on 353 |
| open, partial bars arriving (13:26 UTC) | 560cb56b | 291 / 356 | 0 / 356 | 291 |
| first fresh run (13:41 UTC) | 4984a236 | 0 / 355 | 0 / 355 | 0 |
| Sunday 09-13 / Labor Day 09-07 (14-day table, 09-14 report §3) | ~34k rows/day | 99.4% | (field not yet deployed) | setup AVOID 99.6–100% |
| **Tuesday pre-open, Monday bars cross 36 h (12:02 / 12:17 UTC, 09-15)** | 11:46 → 12:02 → 12:17 | **0 → 196 → 197 / 352** (the yfinance-served symbols; Alpaca bars carry a later timestamp) | **0 / 352** | setup AVOID 302 → 327; live WAIT 24 → 13, AVOID 111 → 122, conf ≥ 70 83 → 41; **v1 candidate ENTER 1 → 0, AVOID 110 → 130; v2 (market-calendar freshness) ENTER 4 → 3, WAIT 24 → 24, AVOID 60 → 61**; `mcal_severe` unchanged at 147 |

LOCAL MAC tests (`tests/test_scanner_diagnostics.py`, 30/30): Friday's bar is
not stale by market calendar on Saturday, Sunday, Monday pre-open or during
Monday's session; one missed close is tolerated (holiday), two are stale; a
nine-day-old bar is stale by both tests; the wall-clock flag stays measurable;
the live `vetoes` / `trade_permitted` columns are unchanged while `mcal_*`
persist.

The weekday case closed at 12:02 UTC on 09-15 exactly as predicted: with no
new bar and no price change, the wall clock flagged 196 symbols the moment
Monday's bar crossed 36 h, the market-calendar test flagged none (Tuesday's
close had not happened, so nothing was missed), the deployed candidate lost
its only ENTER and gained 20 AVOIDs, and v2 — which takes freshness from the
`mcal_*` shadow list — kept 3 ENTER / 24 WAIT. Verdict: **bug** — the freshness test measures calendar hours, not
market sessions, and it is wired into five downstream blocks (setup AVOID,
data-quality −30 → LOW_CONFIDENCE_DATA, confidence −37, trade_permitted,
candidate SEVERE_VETO). Live gate unchanged; shadow columns measure the fix.

## 3. PROD HOST — gate-by-gate on fresh rows, and why the deployed candidate says 0 ENTER

7-day fresh chain (09-14 report §4, reproduced live 23 = 23): SELL action
57.7% → EXIT; `recommendation_quality` ≠ TRADE_READY removes 94% of the rest;
`final_score ≥ 80` removes 97.5% of what is left (914 → 23). First fresh run
today: SELL 63% (225/355), TRADE_READY 0/355.

Candidate on the same fresh run: 225 EXIT (same SELL action), 75 AVOID on
severe vetoes (POOR_RISK_REWARD 77 / STOP_RISK 39 / EXTREME_VOLATILITY 31,
overlapping), 38 WATCH on `pre_expansion < 45`, 12 WATCH on action ≠ BUY,
5 other. **Nothing reaches the 55–70 band test.** The candidate's own gates
never get to act; the upstream verdicts decide.

## 4. PROD HOST — why BREAKOUT is 0 of 132,972 fresh rows

Two mechanisms, both measured.

**(a) The partial-bar volume artefact.** `score_relative_volume` and the
volume bonus inside `score_breakout_quality` divide the *current* bar's
volume by the 20-day average. During the session the current bar is partial,
so relative volume is structurally low until the close (`volume_by_hour`, 7
days, fresh equity rows):

| UTC hour | rows | relvol median | relvol ≥65 | breakout median | rows meeting brk≥72 ∧ vol≥65 ∧ mom≥68 | setup_type=BREAKOUT |
|---:|---:|---:|---:|---:|---:|---:|
| 00–11 (full bar) | ~5,200/h | 48.1–48.4 | 13.3–13.9% | 8.0 | 9–17 | **0** |
| 14 | 6,048 | **22.7** | **1.1%** | 1.3 | 4 | 0 |
| 16–18 | ~5,300/h | 29.1–34.7 | 1.5–3.4% | 1.1–2.5 | **0** | 0 |
| 19 | 5,200 | 38.5 | 5.5% | 3.4 | 0 | 0 |
| 20–23 (post-close) | ~5,200/h | 47.7–48.2 | 12.8–13.6% | 8.0 | 14–17 | **0** |

**(b) The target-geometry veto.** Even when the numeric triple holds (412
fresh rows, 5 symbols in 7 days: DVN, GNW, HPE, USO, XLE), all 412 are
`setup_type=AVOID`, all 412 carry `POOR_RISK_REWARD` (severe), all 412 are
`recommendation_quality=AVOID`, live AVOID 412/412
(`breakout_candidates_why`). LOCAL MAC: `risk_reward` is
`(take_profit_low − price) / risk`, and `take_profit_low` is the *nearest
resistance above price × 1.005* among the 3M/6M/1Y highs and the prior
20-day high. A breakout candidate is by definition within a few percent of
those highs, so its "target" sits just above price, `risk_reward` collapses
below 1.0, the severe veto fires, and `classify_setup`'s first branch turns
it into AVOID before the breakout branch is reached. The balanced target
(1.5–2R, persisted as `balanced_risk_reward_low`) is not consulted. So the
breakout path is self-cancelling: the features that make `breakout_score ≥
72` are the ones that make the nearest-resistance target worthless.

### 4c. Completed-bar volume features, first live reading (run a319927c, 18:16 UTC)

Deployed 18:04 UTC (commit `98abf7d3`, rollback tag
`rollback-scanner-20260914-p11-step5`): `last_bar_partial`,
`relative_volume_score_completed`, `breakout_score_completed` on
`RankedAsset`, observation only. First run with the fields, mid-session:
**352/352 rows flagged partial; relative-volume median 36.9 (live) vs 46.3
(completed bar); 10 rows reach `breakout_score_completed ≥ 72` while
`setup_type=BREAKOUT` stays 0.** The artefact is now measured per run rather
than inferred from hourly aggregates; `run_history` carries `partial_bars`,
`relvol_live`, `relvol_done`, `brk_done72`.

Late-session curve (six runs, 18:16 → 19:31 UTC, all 352 rows partial): live
relative-volume median **36.9 → 37.7 → 38.4 → 39.3 → 40.4 → 41.1** while the
completed-bar median stayed at **46.3** on every run (the completed history
does not change during the session) and `breakout_score_completed ≥ 72` held
at 10 rows. That is the artefact in one curve: the live number converges on
the completed-bar number only as the session fills in. v2 ENTER/WAIT counts
(1–3 / 21–26) did not drift with it, which is expected — v2 does not read
the volume score for its verdict; only the setup class and the
BREAKOUT_VOLUME_LIGHT code do.

### 4d. Post-close confirmation and an operational incident (21:50 UTC check-in)

After the close the two volume numbers converge exactly: from the 21:16 run
onward `last_bar_partial` is 0/352 and the live and completed-bar
relative-volume medians are both **51.5** (the 21:01 run straddled the close:
196 partial). Whole-day curve: 36.9 → 41.1 (session) → 47.2 (20:01) → 51.5
(post-close) against a completed-bar value of 46.3 all session. The artefact
is measured end to end.

**Incident — the daily full scan was skipped.** PROD HOST journal: the 21:30
UTC `market-alpha-full-scan` (500 symbols, analysis, `forward_returns`,
`performance_summary`) exited after 3 s with `[scanner] another run in
progress, skipping` because the fast-scan timer — re-phased by the 10:24
reboot to :26:58 / :41:58 / :56:58 / :11:58 — held the run lock for its
~5-minute run at 21:30. `analysis_freshness` (new read-only bundle)
confirmed no `forward_returns` / `performance_summary` rows for 09-14 (last
09-11 21:36). Friday's run had a different phase and was not hit.

Fix (`8e5a287c`, scanner image rebuilt 21:54, tag
`rollback-scanner-20260914-p11-step6`): `scanner_run_lock` gains a bounded
wait (15 s polls); FULL runs wait up to 10 minutes
(`TRADEVETO_SCANNER_LOCK_WAIT_SECONDS` overrides), fast runs still skip at
once (7/7 safety tests). Recovery: the new confirm-gated relay action
`prod_full_scan` started the full scan at 21:57:22; it logged "waiting up to
600s for the lock" every 15 s behind the 21:56:58 fast run, **acquired the
lock at 22:01:54, wrote 352 signals, then `performance_summary=235,
forward_returns=5448` at 22:08:36** (analysis 93.9 s, total 672 s) and
released the lock before the 22:11:58 fast scan. Tomorrow's 21:30 run will
wait the same way instead of skipping. The timer phase itself is untouched
(re-anchoring it is a systemd mutation outside the relay allowlist; with the
wait in place it no longer matters).

### 4e. Second incident — the midnight NaN bar (00:15 UTC check-in, fixed and verified)

At 00:02 UTC, the first scan after the UTC date rolled, the live picture
changed on unchanged prices: EXIT 194 → 245 (00:16: 258), AVOID 118 → 87,
median technical 43.2 → 33.2, median `trend_score` 55 → 5, `trend_score = 0`
on **148** symbols (50 the run before), v2 ENTER 1 → 0, conf ≥ 70 35 → 22.
`run_compare` showed providers, regime, history rows (500) and
`data_timestamp` (09-14) unchanged; `symbol_run_diff` on IOT showed the
mechanism: `price` 42.91 → 38.38 (Friday's close), `return_1d` +11.8% →
−0.16%, `atr_pct` and `avwap_ytd`/`avwap_swing` → null, `pre_expansion_bars`
500 → 499, `breakout_score` 67.9 → 8, `action` BUY → SELL, live AVOID → EXIT.
The just-finished 09-14 bar had come back from yfinance with **NaN OHLC and a
set Volume**; `dropna(how="all")` kept it, so every indicator reading
`close.iloc[-1]` saw NaN (trend structure → 0, momentum/RSI/MACD/ATR/AVWAP
garbage) while the engine's `close.dropna()` price fell back a session.
Alpaca-served symbols were unaffected.

Fix (`3eb0ca73`, scanner image rebuilt 00:23, tag
`rollback-scanner-20260915-p11-step7`): `drop_rows_without_close` at the
yfinance provider boundary (both code paths), the dropped count persisted as
`rows_without_close`, 10/10 provider tests (one pre-existing fixture fixed).
**Verified on the 00:27 run (PROD HOST `nan_close_check`): 197 yfinance
symbols had exactly one NaN-close row dropped, `avwap_ytd` null on 0 rows,
`trend_score = 0` back to 47 (33 yfinance + 14 alpaca, the evening level),
EXIT 258 → 203, conf ≥ 70 18 → 39, v2 ENTER 0 → 3.** This corruption has
presumably been running every night from 00:00 UTC until yfinance
re-publishes the bar — the end-of-day canonical rows `forward_returns` links
to are the *last* scan of the UTC day (23:47), which predates it, so the
replay cohorts in §5 are not contaminated, but every overnight /terminal
view was.

**What the fix changes and what it cannot (04:00 UTC reading).** With the NaN
row gone, the affected symbols' last valid bar was Friday's, so the 00:47 and
01:17 runs showed the *wall-clock* `STALE_DATA` veto on 246 and 197 rows
(`rows_without_close` 246 / 197), `mcal` stale on 0 — the honest reading
("the provider has no valid Monday bar yet"), still routed through the
36-hour clock into severe vetoes (EXIT 206 / AVOID 91 at 00:47). From 01:48
yfinance had re-published the Monday bar: `rows_without_close` 0, STALE 0,
and the runs settled at live `WAIT 22 / WATCH 24 / AVOID 113 / EXIT 193`,
`trend_score = 0` on 50, conf ≥ 70 on **80** rows, v2 **ENTER 4 / WAIT 24**
— unchanged across five consecutive runs to 03:47. So the NaN window is
roughly 00:00–01:30 UTC nightly; the drop fix turns garbage indicators into
a freshness veto, and only the market-calendar freshness test (§6 step 1)
would make those ninety minutes read correctly.

## 5. PROD HOST — replay on matured forward returns (`replay_cohorts`)

Cohort = end-of-day canonical signal per symbol-day (the row `forward_returns`
links to), matured horizons only. **Confound:** windows differ by horizon —
5D covers 2026-04-24 → 09-06, 10D → 07-23, 20D → 07-22 (a strong-market
stretch); compare cohorts *within* a horizon, not across. `mean/med/p10` in
percent, `win` = share > 0.

| cohort | 5D n / mean / med / win / p10 | 10D n / mean / med / win / p10 | 20D n / mean / med / win / p10 |
|---|---|---|---|
| B fresh baseline | 118,082 / +0.20 / +0.02 / 50.2 / −6.54 | 82,325 / +0.71 / +0.37 / 52.9 / −8.94 | 26,193 / +2.81 / +0.79 / 57.0 / −8.06 |
| C live ENTER | 123 / **−0.54** / −0.92 / **34.1** / −2.19 | 114 / +3.37 / +3.59 / 66.7 / −3.03 (2 days) | 76 / +3.62 / +4.53 / 65.8 / −5.84 (2 days) |
| D live EXIT (SELL action) | 49,813 / −0.03 / −0.30 / 47.1 / −8.01 | 33,040 / +0.20 / +0.11 / 50.6 / **−11.55** | 7,852 / +0.78 / −0.03 / 49.8 / **−11.59** |
| E live AVOID | 47,555 / +0.51 / +0.33 / 54.6 / −5.72 | 32,132 / +1.16 / +0.56 / 54.5 / −7.58 | 8,853 / +4.78 / +1.33 / 63.6 / −5.77 |
| F band core (setup ok, not SELL, enterable, rr≥1.2, no STOP/EXTREME, conf≥70, 55≤score≤70) | 2,645 / +0.69 / +0.61 / 56.0 / −4.97 | 1,669 / +1.30 / +1.47 / 61.8 / −6.33 | 349 / +1.42 / +1.18 / 57.3 / −5.57 |
| G band core but score ≥ 80 | 4 / −0.80 | — | — |
| H band core minus the setup gate | 4,000 / +0.37 / +0.31 / 54.1 / −5.76 | 2,519 / +1.17 / +1.29 / 60.7 / −6.40 | 505 / +1.27 / +0.81 / 56.2 / −5.07 |
| I band core with balanced rr ≥ 1.5 instead of nearest-resistance rr | 2,446 / **+0.77** / +0.78 / **58.3** / **−4.77** | 1,561 / **+1.39** / +1.39 / 61.1 / **−5.90** | 312 / **+2.16** / +1.97 / **62.5** / −5.67 |
| J band core + pre_expansion ≥ 45 | 0 matured rows (field deployed 09-06; no overlap yet) | — | — |
| K breakout numeric triple, fresh | 2,524 / **+1.86** / +1.11 / **64.2** / −7.60 | 1,829 / **+3.22** / +1.41 / 61.3 / −11.11 | 593 / **+14.92** / +10.97 / **82.8** / −2.67 |
| L rr<1.0 (POOR_RISK_REWARD) but enterable, not SELL, 55–70 | 6,107 / +0.27 / +0.28 / 52.9 / −4.95 | 4,221 / +0.61 / +0.66 / 57.7 / −6.00 | 1,202 / +1.83 / +0.64 / 60.6 / −6.99 |
| M wall-clock stale rows | 44,619 / +0.95 / +0.90 / 57.9 / −6.20 | 29,680 / +1.45 / +1.13 / 57.4 / −8.44 | 2,866 / +2.34 / +1.77 / 61.0 / −11.27 |

Reading, within horizon:
- The live `≥ 80` rule leaves **4** rows in the band-core cohort (G) and
  its 123 real ENTERs lost money at 5D with a 34% hit rate. The band (F)
  beats the fresh baseline at 5D and 10D on mean, median, hit rate and p10.
- **The setup gate earns its keep** (H < F at every horizon): the fix is to
  stop writing the verdict into the class, not to drop the gate.
- **The nearest-resistance risk/reward is the wrong number** (I > F at every
  horizon, L ≈ baseline): rows the severe `POOR_RISK_REWARD` veto removes are
  not worse than baseline, and swapping in the balanced target improves every
  metric of the band cohort.
- **The self-cancelled breakouts (K) are the best cohort in the data** at all
  three horizons, with a fatter 5D/10D tail (p10 −7.6 / −11.1) that argues
  for the 1.5R stop discipline, not for the veto.
- `EXIT` rows (D) have the worst tails but a 50% hit rate: the SELL action
  is a "do not enter" signal, not an exit.
- Stale-flagged rows (M) are ordinary weekend/holiday EOD rows and perform
  like the baseline — the flag carries no risk information.

## 5b. PROD HOST — candidate v2 shadow, first fresh reading (run e761abcc, 14:02 UTC)

Deployed 14:05 UTC as `candidate_v2_*` (commits `4774a1a1`, `65c4a7fc`;
rollback tags `…-p11-step3/4`). v1 vs v2 on the same 355 rows:
EXIT→EXIT 220 (the SELL action is untouched), AVOID→AVOID 50, AVOID→WATCH 9,
**AVOID→WAIT_PULLBACK 20, AVOID→ENTER 2**, ENTER→ENTER 1, WATCH→WATCH 53.
Reason codes: RR_BALANCED_TARGET 31 (nearest-resistance target inside the 4%
band), SEVERE_POOR_RISK_REWARD 34 (down from 77 live), SEVERE_STOP_RISK 16,
SEVERE_EXTREME_VOLATILITY 2, LATE_ENTRY 15, ABOVE_ENTRY_BAND 5, NO_BUY_SIGNAL
54, LOW_CONFIDENCE 5, NO_SETUP_FORMING 3, BREAKOUT_VOLUME_LIGHT 11.

What a trader would have seen (`candidate_v2_sample`):

| symbol | live | v1 | v2 | class | WHERE (zone / stop / target) | rr v1 → v2 | score | conf | why |
|---|---|---|---|---|---|---|---:|---:|---|
| SAIC | AVOID | AVOID | **ENTER** | BREAKOUT | 125.33–128.71 / 120.29 / 142.66 | 1.07 → 1.50 | 63.9 | 74.6 | in band, near entry, balanced target; volume light |
| TMO | WATCH | ENTER | **ENTER** | PULLBACK | 602.83–610.16 / 586.18 / 636.76–642.43 | 1.11 | 62.2 | 74.5 | in band, buy zone, pre-expansion 55 |
| KO | WAIT_PULLBACK | AVOID | **ENTER** | PULLBACK | 88.02–88.88 / 86.24 / 92.48 | 1.09 → 1.50 | 61.6 | 74.5 | in band, near entry |
| XOM, DVN, CVX, XLE, MPC, SM | AVOID | AVOID | WAIT_PULLBACK | BREAKOUT | each with zone / stop / target | 0.06–0.40 → 1.50 | 75–82 | 50–58 | late entry (overextended) — the energy rally; "you are late, here is the zone" |
| FANG, EOG, OXY, MUR, AAPL, PFG, V, IMO | AVOID | AVOID | WAIT_PULLBACK | PULLBACK | each with zone / stop / target | 0.07–0.67 → 1.50 | 72–80 | 47–68 | late entry or above band |

Every v2 ENTER/WAIT row carries a zone, a stop and a target (23/23). The live
engine said AVOID for 21 of these 23 and WATCH/WAIT for the other two, with
no level a reader could act on. This is the WHAT/WHERE difference in one run;
WHICH (ranking for capital) and whether these calls are *right* wait for the
forward returns.

## 6. Candidate v2 — what the evidence says to build (shadow only)

1. Freshness by market calendar (`mcal_*`, deployed) feeding the candidate's
   severe list instead of `STALE_DATA`.
2. Setup class without a verdict: PULLBACK / BREAKOUT / CONTINUATION / NONE
   from trend, momentum, breakout, volume, AVWAP; reason codes instead of
   AVOID; `_is_overextended` becomes a *location* code (late entry), not a
   class killer.
3. Risk/reward from the balanced target when the nearest resistance is inside
   the breakout band (≤ 4% above price): `POOR_RISK_REWARD` keeps its severity
   only when the balanced 1.5R target is also unreachable.
4. Volume features from the last *completed* bar during the session, the
   partial bar only after the close (or scaled by session progress) — this
   is upstream of both engines and would change live scores, so it is
   measured first as `relvol_completed_bar` beside the live score.
5. SELL action → `NO_ENTRY` for unheld symbols; `EXIT` reserved for held
   positions.
6. Band 55–70 with confidence ≥ 70 after advisory penalties, as now.

Each of 1–5 is an observation column first; the v2 decision is written to
`candidate_*` only after the columns have been read on prod for at least a
day. Acceptance for any switch remains §6 of the 09-14 report.

## 7. P2-4 — closed (no new finding)

Operator `sudo reboot` at 10:24:22 UTC from an interactive SSH session; the
watchdog was `ok/0 findings` before and after; containers restarted clean.
Documented in the 09-14 report §8. Nothing further.

## 8. Health checks (PROD HOST / PROD WEB)

| time (UTC) | /api/health | /api/health/deep | latest scan | timers | containers | note |
|---|---|---|---|---|---|---|
| 13:41 | 200 | 200 | 13:31 success 359 | fast-scan next 13:41:58; full-scan 21:30; scanner-health 06:19 | frontend/hot-api/postgres healthy, up 3h | after the operator reboot |
| 15:01 | 200 (ttfb 0.18 s) | 200 (0.16 s) | 14:49 success 356 | fast-scan last 14:56:59 (running at check time); full-scan 21:30 | frontend/hot-api recreated 14:18 (healthy, 42 min), postgres up 5 h | backup completed 12:55 UTC via r2 (age 126 min at check) |
| 16:31 | 200 | 200 | 16:16 success 359 | fast-scan on cadence (12 runs since 13:41, all success); full-scan 21:30 | frontend/hot-api recreated 15:11 (healthy), postgres healthy | 11 consecutive fresh runs; live ENTER 0 in all, v1 ENTER 3, v2 ENTER 3–4 / WAIT 15–23 |
| 18:01 | 200 | 200 (backup event 12:55 r2 ok) | 17:47 success 352 | fast-scan on cadence (17 fresh runs since 13:41); full-scan 21:30 | RestartCount 0 on frontend/hot-api (recreated 16:36), postgres, caddy; load 1.7/1.1/0.7; frontend rss 409 MB, event-loop p99 11.5 ms | no anomalies |
| 19:46 | 200 | 200 | 19:31 success 352 | fast-scan on cadence (24 fresh runs since 13:41) | all healthy, load 0.7 | none |
| 22:09 | 200 | 200 | 22:07 full scan success 352 + analysis (forward_returns 5448) | fast-scan on cadence; full-scan recovered manually after the lock skip | all healthy | full-scan lock collision (fixed, see §4d) |
| 00:17 | 200 | 200 | 00:02/00:16 success 352 | fast-scan on cadence | all healthy, load 2.8 (full scan just ran) | **midnight NaN-bar corruption (fixed 00:23, see §4e)** |
| 00:33 | — | — | 00:31 success 352, `rows_without_close`=1 on 197 yfinance symbols, trend_zero 47 | — | — | fix verified |
| 12:21 | 200 | 200 | 12:17 success 352 — **weekday pre-open stale test: wall-clock 197, market-calendar 0** | fast-scan on cadence | all healthy | expected, see §2 |
| 09:31 | 200 | 200 | 09:17 success 352 (steady: live 0/22/26/111/193, v2 4/24, conf≥70 83) | fast-scan on cadence | all healthy, load 0.35 | none |
| 06:46 | 200 | 200 | 06:31 success 352 (steady since 01:48: live 0/22/25/112/193, v2 4/24, conf≥70 79–82, STALE 0, NaN rows 0) | scanner-health timer ran 06:19 (next 09-16 06:16); fast-scan on cadence | all healthy, load 0.7, frontend rss 377 MB | R2 backup sync started 06:31 (in progress at check) |
| 04:00 | 200 | 200 | 03:47 success 352 (5 identical overnight runs since 01:48; STALE 0, nan_close 0) | fast-scan on cadence | all healthy, load 0.5 | replay_cohorts re-run: no drift (5D n +0.4%, F/I/K within 0.02 pts) |

## 9. Changes shipped in this window

| commit | what | deploy |
|---|---|---|
| `079fa6fa` | `stale_by_market_calendar`, `missed_sessions` (observation) | scanner image rebuilt 12:46, tag `rollback-scanner-20260914-p11-step1`; 12:56 scan on new image |
| `d94920e0` | `mcal_vetoes` / `mcal_severe_vetoes` / `mcal_data_quality_score` (observation); relay bundles `run_history`, `run_snapshot`, `candidate_actionable_sample`, `volume_by_hour`, `breakout_candidates_why` | scanner image rebuilt 13:47, tag `rollback-scanner-20260914-p11-step2` |
| (relay only) | `replay_cohorts` bundle | self-reloaded worker |
| `4774a1a1` | `candidate_v2_*` shadow columns (market-calendar freshness, class-not-verdict, balanced-target rr, no quality read); relay `candidate_v2_sample`, `candidate_v2_reasons`, v2 counts in `run_history` | scanner image rebuilt 13:54, tag `rollback-scanner-20260914-p11-step3`; 13:56 scan on it |
| `3eb0ca73` | market data: drop yfinance bars with NaN Close; `rows_without_close` persisted | scanner image rebuilt 00:23 (09-15), tag `rollback-scanner-20260915-p11-step7`; verified on the 00:27 run |
| `8e5a287c` | scanner: FULL runs wait ≤10 min for the run lock; relay `prod_full_scan` (confirm-gated) + `analysis_freshness` | scanner image rebuilt 21:54, tag `rollback-scanner-20260914-p11-step6`; verified live on the 21:57 full scan |
| `98abf7d3` | scanner: `last_bar_partial`, `relative_volume_score_completed`, `breakout_score_completed` (observation) | scanner image rebuilt 18:04, tag `rollback-scanner-20260914-p11-step5`; 18:11 scan on it |
| `896fb390` | /terminal: shockPattern + timingValidation projection (lever 1, slice 2) | frontend rebuilt + recreated 16:35, tag `rollback-frontend-20260914-shockpattern`; PROD WEB 6,530 → 5,387 KB |
| `e48fc392` | /terminal: narrative projection at the client boundary (lever 1, slice 1) | frontend rebuilt + recreated 15:11, tag `rollback-frontend-20260914-narrative`; PROD WEB 6,972 → 6,530 KB |
| `fa00f4cb` | /terminal: `ExecutionTimingSystem.rows` no longer serialised (lever 2) | frontend rebuilt + recreated 14:18, tag `rollback-frontend-20260914-execrows`; PROD WEB 9,011 → 6,980 KB |
| `65c4a7fc` | v2 class `UNCLASSIFIED` (the payload writer nulls the string "none"); `v2_where_full` in `run_history` | scanner image rebuilt 14:05, tag `rollback-scanner-20260914-p11-step4` |

## 10. Fill-in work — /terminal payload duplication audit (LOCAL, checkout of `bd16023a`)

Read-only code audit of the ~9 MB `/terminal` RSC document (prior PROD WEB
measurement: fragility ×3719, conviction ×1026, reason ×1875 field
occurrences; the chart hub was ~1%). Rows come from `getFullRanking()` with no
limit (~349 rows), each an `OpportunityViewModel` with 35 scalar fields plus
`raw` (154 allow-listed scanner keys), `narrative` (22 prose strings),
`evidence` (incl. `reasons[]`, `limitations[]`) and `shockPattern` (~30
fields). Only *client* component props are serialized; the server-only
panels (ActionTriageStrip, DailyActionCard, heatmap, radar, right rail) emit
HTML.

| prop / builder | rows carried | per-row payload | fold |
|---|---|---|---|
| `UnifiedIntelligenceConsole rows={clientRows}` (`TerminalPremiumView.tsx:322`) | all | whole view model incl. `raw`, `narrative`, `evidence`, `shockPattern` | **above** |
| `ExecutionIntelligencePanel system={executionTimingSystem}` (`:287`, `execution-intelligence.ts:123`) | all, but the panel renders ≤20 from five pre-sliced buckets | 6 score objects + calibration arrays + 5 zone strings + 5 string arrays per row | below (`<details>`) |
| `actionability={actionabilityMap}` (`:291`, `terminal-actionability.ts:52`) | all (by design: shockEvents are stripped) | 5 prose strings per symbol | below |
| Intraday/RegimeShift/Institutional panels, both radars, watchlist (`:395–404, :460`) | same array reference → Flight dedupes to one copy | — | below |
| DailyMarketCommandCenter / GlobalMarketCommandCenter | bounded (≤12 per list; 8 macro charts) | — | above |

Duplication actually present: the same rows are re-derived into a second full
per-row graph (`buildExecutionTimingSystem`) and a third
(`buildTerminalActionabilityMap`); `buildUnifiedIntelligenceConsole` runs on
the server *and* again in the browser; of `narrative`'s 22 strings only two are
read on this page, of `evidence`'s 14 fields only `label`/`score`.

Levers, by expected savings: (1) a single terminal-scoped row projection at
the serialization boundary (narrow `raw`, `narrative` → 2 strings, `evidence`
→ 3 fields, `shockPattern` → the rendered dozen), guarded by an import-graph
test like `raw-field-allowlist.test.ts` — ~2–4 MB; (2) stop serializing
`ExecutionTimingSystem.rows` (the panel only reads the buckets, which keep
references to ≤20 models) and shrink the actionability map to the reachable
set behind an on-demand route — ~0.8–1.2 MB, with the actionability contract
(`terminal-actionability.ts` comment) respected by shipping the fetch first;
(3) feed the console the server-built model instead of `rows`, then
lazy-mount the six below-fold row consumers as `LazyMarketChartHub` does —
the only above-fold full-row prop leaves the first document. Risks: console
zone switching must be precomputed for every workspace preference; the
watchlist must still resolve any saved symbol; radars need the full symbol
universe (trim fields, not rows); the projection must not re-widen `raw`
(previous leaks: `provider_error`, `alpaca_request_id`,
`provider_latency_ms`) and must keep `dataFreshness` / stale fields for the
WAIT/AVOID copy. Lever 2's `rows: []` slice is the smallest measured unit to
ship first; each step is its own commit → relay push → prod pull → frontend
rebuild → PROD WEB + PROD HOST measurement.

**Shipped (commit `fa00f4cb`, frontend deploy 14:18 UTC, rollback tag
`rollback-frontend-20260914-execrows`, containers healthy at health[3]).**
`stripExecutionTimingRowsForClient` drops `ExecutionTimingSystem.rows` at the
/terminal boundary; `rowCount` keeps the no-rows state; buckets keep their
references. LOCAL MAC: 12/12 execution tests, tsc clean. **PROD WEB (logged-in,
`fetch('/terminal')`, two samples each): decoded document 9,011 KB → 6,980 KB
(−2,031 KB, −22.5%)**, 2.0 s → 1.8–2.4 s (noise range), the Execution
Intelligence panel renders the same content (356 symbols reviewed, five
buckets populated, no "Timing Context Unavailable"). The remaining
`timingQualityScore` occurrences (368) belong to the per-row timing-proof
summaries inside the opportunity rows themselves — lever 1 territory. PROD
HOST smoke after the recreate: all routes 200 (market-charts 401 = premium
gate).

**Shipped (commit `e48fc392`, frontend deploy 15:11 UTC, rollback tag
`rollback-frontend-20260914-narrative`).** PROD WEB attribution of the 6,972 KB
document before this step: `shockPattern` blocks 1,716 KB (356 × 4.9 KB, of
which `timingValidation` ~1.3 KB each), `raw` 1,160 KB (356 × 3.3 KB),
`narrative` 517 KB (111 narrated rows × 4.8 KB), `evidence` 230 KB, the eight
macro charts 305 KB, the actionability map 172 KB. Lever 1, first slice:
`stripNarrativeForTerminal` keeps 8 of 22 narrative fields (the ones the
`rows={clientRows}` consumers read: moderatorSummary, narrativeSummary,
pressureStory, narrativeDrift + identity fields), guarded by
`terminal-narrative-projection.test.ts`, which derives its roots from
TerminalPremiumView's own `rows={clientRows}` props and walks the value-import
graph (4/4; raw allowlist 13/13; tsc clean). **PROD WEB after: 6,972 → 6,530 KB
(−442 KB); narrative blocks 517 → 106 KB; `narrativeDrift` still present on
all 111 rows;** the Shock Move and Risk-Tolerant radars, the console and the
watchlist render with content, no error banner. Next slices in the same
pattern: `shockPattern` (25 of ~40 fields read; `timingValidation` 4 of ~15)
and a terminal-scoped `raw` allowlist (104 of 154 keys, plus the 12 keys read
through `rawField()` indirection that the name-based guard cannot see — those
are stripped *today* and silently yield defaults; they should be added back
before any further raw trimming).

**Shipped (commit `896fb390`, frontend deploy 16:35 UTC, rollback tag
`rollback-frontend-20260914-shockpattern`).** Lever 1, second slice:
`stripShockPatternForTerminal` keeps the 26 pattern fields the row consumers
read (via `row.shockPattern`, `shock` and `pattern` aliases) and projects
`timingValidation` to its four read sub-fields (`replayStudies` and a dozen
unread statistics go). The graph walker is now shared
(`terminal-client-graph.test-helper.ts`) by the narrative and shock-pattern
guards (29/29 across projection, allowlist and execution-boundary tests; tsc
clean). **PROD WEB after: 6,530 → 5,387 KB (−1,143 KB); shockPattern blocks
1,716 → 541 KB; `replayStudies` 0 occurrences.** Shock Move radar renders
timing proof, similarity, reliability, false-alarm and volume-quality values;
no NaN/undefined in the page text; PROD HOST smoke 200. **Cumulative today:
9,011 → 5,387 KB (−40%)** in three isolated, measured commits.
