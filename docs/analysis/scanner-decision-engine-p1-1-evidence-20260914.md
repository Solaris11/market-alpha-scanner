# P1-1 — Why the scanner says ENTER=0 / setup_type=AVOID, what the shadow engine really does, and a safe rollout plan

Date: 2026-09-14. Branch `work/terminal-ia-simplification`. Status: **evidence
complete for the stale window and the 7-day fresh window; first fresh-market
shadow data lands with the ~13:45 UTC scan and is appended in §7.**

Environment labels: **PROD HOST** = the production box through the guarded
relay (scan journal, Postgres in the container, read-only queries);
**LOCAL MAC** = code reading on the checked-out repo, never presented as
production evidence. Every number below carries its label.

## 0. TL;DR

1. **Today's picture (Monday, pre-open) is a data-freshness artefact, not a
   decision-engine verdict.** PROD HOST, run finishing 12:01:20 UTC, 356 rows:
   `STALE_DATA` (a *severe* veto) on **354/356**, `LOW_CONFIDENCE_DATA` on 299,
   `setup_type=AVOID` **355/356**, live `EXIT 207 / AVOID 108 / WATCH 40 /
   WAIT_PULLBACK 1 / ENTER 0`. The stale flag is a **calendar clock** (last bar
   older than 36 h, `scanner/diagnostics.py` `STALE_DATA_HOURS = 36`), so from
   Saturday 12:00 UTC until the first partial bar on Monday (~13:30–14:00 UTC)
   every equity is "stale", and the same happens every weekday between 12:00
   UTC and the open. Measured on PROD HOST over 14 days: weekdays **3.4%**
   stale, Saturday **38–42%**, Sunday/holiday/Monday-pre-open **99.4%**, and
   on those days setup AVOID is **99.6–100%**.
2. **On fresh data the engine still says ENTER for 0.017% of rows, and the
   funnel is now measured, not inferred.** PROD HOST, 7 days, 132,972 non-stale
   rows, gate chain re-derived from the persisted fields in the engine's own
   order reproduces the live count exactly (23 = 23): `composite_action` SELL
   removes **57.7%** (→ EXIT), `recommendation_quality` removes another
   **94%** of the remainder (TRADE_READY is 1.7% of rows), and the final
   `final_score ≥ 80` floor removes **97.5%** of what is left (914 → 23).
   Setup-type, setup-strength, veto and entry-location gates remove *nothing
   further* at that point because `recommendation_quality` has already
   absorbed them (the −25 setup penalty).
3. **`setup_type=AVOID` is the default outcome by construction** (LOCAL MAC,
   `scanner/setup_engine.py::classify_setup`): any severe veto → AVOID; a
   breakout context needs `volume ≥ 65 and momentum ≥ 68`; pullback needs
   near-AVWAP context **and** `trend ≥ 70`; continuation needs `trend ≥ 72 and
   momentum ≥ 58`; the `else` branch is AVOID. On fresh data it is AVOID for
   **80.7%** of rows, PULLBACK 18.9%, CONTINUATION 0.4%, **BREAKOUT 0.0%** (0
   of 132,972 — the breakout path never fires in production).
4. **The shadow (candidate) engine is not yet a fix, and today it cannot even
   be measured.** Its columns have been persisted only since ~01:00 UTC today
   (16,020 rows, all inside the stale window), where it says `EXIT 207 / AVOID
   148 / WATCH 1 / ENTER 0` — stricter than live on the same inputs, because
   it consumes the same three upstream verdicts: the SELL action (→ EXIT), the
   severe veto list (STALE_DATA → AVOID), and `recommendation_quality` (which
   still carries the −25 setup penalty). It has zero rows from a fresh market
   window so far.
5. **Rollout decision: `SCANNER_DECISION_MODE` stays `current`.** Switching
   today would change nothing a user sees and would prove nothing. The safe
   path (§6) fixes the two *upstream* defects that starve both engines — the
   calendar-clock stale test and the setup-verdict double count — as
   observation-only columns first, accumulates ≥10 trading days of fresh-window
   shadow rows joined to matured `forward_returns`, and only then moves the env
   var, on a dry-run outdir before a live scan, with a one-line rollback.

## 1. Sources

| # | Source | Env | What it gave |
|---|---|---|---|
| S1 | `journalctl -u market-alpha-fast-scan` via relay `prod_logs_recent` | PROD HOST | per-run `[scanner] decision funnel / median shortfall / shadow / candidate` lines |
| S2 | relay `prod_db_read` bundles `shadow_summary`, `shadow_comparison`, `funnel_blockers`, `upstream_drivers`, `code_frequencies`, `candidate_avoid_reasons` | PROD HOST | latest run (1e53cc5a → run finishing 12:01 UTC), 356 rows |
| S3 | `stale_by_hour` (7 d), `stale_by_day` (14 d) | PROD HOST | freshness × decision by UTC hour and by day |
| S4 | `fresh_window_funnel`, `fresh_cumulative_gates` (7 d, non-stale rows) | PROD HOST | the gate chain, re-derived from persisted fields |
| S5 | `forward_returns_by_decision` (30 d) | PROD HOST | matured 1D–5D returns by live decision |
| S6 | `scanner/{diagnostics,setup_engine,recommendation_quality,final_decision,engine,scoring,candidate_decision,decision_funnel}.py` | LOCAL MAC | the causal chain |
| S7 | `docs/analysis/scanner-decision-audit-20260905.md`, `entry-score-threshold-holdout-study.md`, `candidate-replay-20260906.txt` | LOCAL MAC | prior measurements this note extends, not repeats |

All relay result files are under `.agent-relay/results/20260914T12*.json`.

## 2. PROD HOST — the latest run (12:01:20 UTC, 356 rows)

Scan journal line (S1):

```
[scanner] decision funnel: rows=356 sell_action=207 quality_avoid=108 quality_low_edge=39 quality_wait_pullback=1 action_not_buy=1 | observer_agreement=1.0
[scanner] median shortfall: confidence_score=-88.28 final_score=-53.88 setup_strength=-101.0
[scanner] shadow rule=floor live_enter=0 shadow_enter=0 differs=0
[scanner] candidate mode=current rows=356 EXIT=207 AVOID=148 WATCH=1 | enter_already_expanded=0
```

Live vs candidate crosstab (S2, `shadow_comparison`):

| live | candidate | rows |
|---|---|---:|
| EXIT | EXIT | 207 |
| AVOID | AVOID | 108 |
| WATCH | AVOID | 39 |
| WAIT_PULLBACK | AVOID | 1 |
| WATCH | WATCH | 1 |

Agreement 316/356; every disagreement is the candidate being *stricter*.

Upstream fields on the same rows (S2, `upstream_drivers`, `code_frequencies`):

| field | distribution |
|---|---|
| vetoes | **STALE_DATA 354**, LOW_CONFIDENCE_DATA 299, OVEREXTENDED_ENTRY 79, POOR_RISK_REWARD 61, HIGH_VOLATILITY 54, STOP_RISK 42, EXTREME_VOLATILITY 32 |
| setup_reason_codes | SETUP_AVOID 355, **DATA_QUALITY_SETUP_RISK 354**, MOMENTUM_CONFIRMED 156, TREND_INTACT 136, HIGH_VOLATILITY_SETUP 86, POOR_RISK_REWARD_SETUP 61 |
| composite_action | STRONG SELL 104, SELL 103, WAIT / HOLD 101, BUY 40, STRONG BUY 8 |
| recommendation_quality | AVOID 191, LOW_EDGE 163, WAIT_PULLBACK 1, TRADE_READY 1 |
| confidence_score | **<50: 353**, 50–69: 2, ≥70: 1 |
| entry_status | BUY ZONE 123, NEAR ENTRY 112, OVEREXTENDED 79, STOP RISK 42 |
| trend_score | ≥72: 134, 70–72: 2, 50–69: 45, <50: 175 |
| final_score | <52: 217, 52–59: 60, 60–69: 53, 70–79: 20, ≥80: 6 |
| market_regime | NEUTRAL 356 |
| candidate_reason_codes | SELL_SIGNAL 207, **SEVERE_VETO 148**, ADVISORY_OVEREXTENDED_ENTRY 79, ADVISORY_HIGH_VOLATILITY 54 |

Read together: 136 rows have an intact trend and 235 are in an enterable
location, yet 355 are `setup_type=AVOID` — because 354 carry a severe *data*
veto, which `classify_setup` turns into AVOID before it looks at trend or
location. The "median shortfall" line measures distance to the AVOID
thresholds (`score 101 / confidence 101 / strength 101`), i.e. to a bar that
cannot be met by design.

The counterfactual `quality_if_no_setup_penalty` (quality_score + 25 on the
355 setup-AVOID rows): 175 would sit in the WAIT_PULLBACK band, 13 in
TRADE_READY, 70 LOW_EDGE, 97 AVOID — versus the actual 1 / 1 / 163 / 191. The
−25 alone moves 188 of 355 rows out of the actionable bands.

## 3. PROD HOST — freshness is a calendar clock (S3)

By day, 14 days (`stale_by_day`):

| day | dow | rows | STALE_DATA % | setup AVOID % | live ENTER | candidate rows |
|---|---|---:|---:|---:|---:|---:|
| 08-31 | Mon | 16,334 | 9.6 | 86.5 | 0 | 0 |
| 09-01 | Tue | 34,148 | 3.3 | 85.9 | 0 | 0 |
| 09-02 | Wed | 34,144 | 3.4 | 86.2 | 13 | 0 |
| 09-03 | Thu | 34,124 | 3.4 | 86.4 | 77 | 0 |
| 09-04 | Fri | 34,011 | 3.4 | 86.5 | 38 | 0 |
| 09-05 | Sat | 33,936 | 42.3 | 91.5 | 0 | 0 |
| 09-06 | Sun | 33,931 | **99.4** | **100.0** | 0 | 0 |
| 09-07 | Mon (Labor Day) | 33,984 | **99.4** | **100.0** | 0 | 0 |
| 09-08 | Tue | 33,996 | 55.9 | 90.8 | 4 | 0 |
| 09-09 | Wed | 33,902 | 3.5 | 80.5 | 10 | 0 |
| 09-10 | Thu | 33,750 | 3.4 | 82.2 | 0 | 0 |
| 09-11 | Fri | 33,927 | 3.4 | 82.0 | 9 | 0 |
| 09-12 | Sat | 31,311 | 37.7 | 88.6 | 0 | 0 |
| 09-13 | Sun | 33,969 | **99.4** | 99.6 | 0 | 0 |
| 09-14 | Mon (to 12:20 UTC) | 17,800 | **99.4** | 99.7 | 0 | **16,020** |

By UTC hour, 7 days (`stale_by_hour`, abridged): stale share is ~42% at every
hour (the weekend + holiday share of the week), rises to **75.6% in the 12:00
hour and 57.5% in the 13:00 hour** (weekday pre-open, when Friday's/yesterday's
bar crosses 36 h) and drops to 35–40% from 14:00. Median `data_age_minutes`
climbs from 14.8 h (14:00 UTC, today's partial bar present) to 35.8 h at 11:00
and 36.9 h at 12:00 — the crossing. All 23 live ENTERs of the week fell in the
13:00–19:00 UTC hours. Candidate columns exist only for the 01:00–12:00 hours
of today.

Mechanism (LOCAL MAC): `engine.attach_price_data_quality` sets
`data_timestamp` to the last bar's index (a daily bar dated 00:00);
`diagnostics._is_stale_timestamp` compares it with `datetime.now(utc)` and
flags `> 36 h`. Daily bars are not "stale" on a Sunday; the market is closed.
`STALE_DATA` is in `SEVERE_DATA_VETOES`, so it becomes: setup AVOID
(`classify_setup` first branch), `data_quality_score −30` → `LOW_CONFIDENCE_DATA`
(a second severe veto), `confidence_score −25 −12`, `trade_permitted=false`,
and candidate `AVOID / SEVERE_VETO`. One clock produces five blocks.

## 4. PROD HOST — the fresh-window funnel, re-derived and validated (S4)

7 days, rows **without** `STALE_DATA`: 132,972. Live decisions: EXIT 76,671
(57.7%), AVOID 36,520 (27.5%), WATCH 15,614 (11.7%), WAIT_PULLBACK 4,144
(3.1%), **ENTER 23 (0.017%)**. setup_type: AVOID 107,357 (80.7%), PULLBACK
25,107, CONTINUATION 508, BREAKOUT 0. Vetoes present: OVEREXTENDED_ENTRY
32,125; POOR_RISK_REWARD 26,574; HIGH_VOLATILITY 19,549; STOP_RISK 16,980;
EXTREME_VOLATILITY 11,940; LOW_CONFIDENCE_DATA 0 (it is purely stale-driven).

Chain A — the live engine's own order, cumulative:

| stage | rows | kept |
|---|---:|---:|
| A0 fresh rows | 132,972 | 100% |
| A1 `composite_action` not SELL / STRONG SELL | 56,301 | 42.3% |
| A2 + quality ∈ {TRADE_READY, WAIT_PULLBACK} | 8,636 | 6.5% |
| A3 + quality = TRADE_READY | 2,245 | 1.7% |
| A4 + action ∈ {BUY, STRONG BUY} | 914 | 0.69% |
| A5 + entry_status enterable | 914 | — |
| A6 + setup_type ≠ AVOID | 914 | — |
| A7 + setup_strength ≥ 64 | 914 | — |
| A8 + veto list empty | 914 | — |
| **A9 + final_score ≥ 80** | **23** | **0.017%** |
| A10 + confidence ≥ 70 | 23 | — |
| A11 actual live ENTER | **23** | ✓ model = reality |

Chain B — what the holdout study's rule would see on the same rows, with
severe vetoes still enforced:

| stage | rows |
|---|---:|
| B1 setup_type ≠ AVOID | 25,615 |
| B2 + not SELL | 23,708 |
| B3 + enterable location | 17,703 |
| B4 + rr ≥ 1.2, no STOP_RISK, no EXTREME_VOLATILITY | 13,522 |
| B5 + confidence ≥ 70 | 10,287 |
| **B6 + score in the 55–70 band** | **7,524 (5.7%)** |
| B7 + score ≥ 80 instead | 12 |

Two facts follow. First, the score floor is the last and hardest gate: the
same rows that pass every structural, risk and confidence test go 7,524 →
12 when the rule is `≥ 80` instead of the band. This is the holdout study's
finding reproduced on the live funnel, in production, with no offline
reconstruction. Second, A4–A8 remove nothing because `recommendation_quality`
already embeds setup, entry and score (`−25 setup AVOID`, `−20 OVEREXTENDED`,
`−30 STOP RISK`, `−15 rr<1`, `−10 sub-60 score`; TRADE_READY needs ≥ 75 from a
base of 50). The audit's fault #2 (the verdict counted twice) is therefore
not a rounding issue: it is *the* quality gate.

`C2`: only 498 of the 107,357 fresh setup-AVOID rows would reach TRADE_READY
without the −25. So on fresh data the setup classifier's AVOID default (fault
#1) and the quality penalty (fault #2) reinforce each other, and the stale
clock (this note's new finding) multiplies both on every closed-market scan.

## 5. PROD HOST — forward returns by live decision (S5, 30 days, matured 1D–5D)

`return_pct` is a fraction (−0.001 = −0.1%).

| decision | n (5D) | avg 5D | median 5D | win% 5D | n (1D) | avg 1D |
|---|---:|---:|---:|---:|---:|---:|
| EXIT | 2,792 | **+0.6%** | +0.1% | 50.7 | 6,800 | −0.1% |
| AVOID | 2,383 | −0.3% | −0.4% | 44.6 | 5,253 | −0.1% |
| WATCH | 345 | +0.1% | 0.0% | 50.1 | 1,029 | −0.3% |
| WAIT_PULLBACK | 88 | −0.4% | −0.5% | 46.6 | 301 | −0.5% |
| ENTER | 3 | −0.4% | +0.1% | 66.7 | 7 | −0.9% (0/7 up) |

Shadow rows: none matured (candidate columns are 12 hours old). What this
table can and cannot say: it cannot rank engines (no shadow rows, and the 23
ENTERs are too few to mean anything). It *can* say that the "EXIT" bucket —
57.7% of the fresh universe, produced by a score-to-action index below 52 —
has the best 5D outcome of any bucket, so labelling it EXIT carries no
demonstrated edge and reads to a user as "sell" for a symbol they never held.
10D/20D horizons are not present in the 30-day `forward_returns` window; the
holdout study's 10D/20D evidence (band beats baseline in 8 of 9 walk-forward
cells; 20D +1.67 pts, CI clear of zero) stands as the prior.

## 6. Rollout plan — evidence-gated, no live mode change

Hard rules: no change to `final_decision` semantics without shadow metrics
*and* matured forward returns; every step is observation-only or env-gated;
scanner image rebuild only when `scanner/` changes; rollback for the mode
switch is unsetting one variable and letting the next 15-minute scan run.

**Step 0 (now, no code change): keep `SCANNER_DECISION_MODE=current`.** The
candidate cannot be assessed until it has fresh-window rows; first ones arrive
today from ~13:45 UTC. Read `shadow_summary` / `candidate_enter_sample` after
each market-hours scan today and append to §7.

**Step 1 — market-aware freshness (scanner, observation-first).** Add a
`data_age_trading_hours` / `stale_by_market_calendar` field computed against
the exchange calendar (last bar is fresh if it is the most recent completed
or partial session; weekends, holidays and pre-open are not staleness) and
persist it next to the existing `stale_data`. Gate nothing for one week; the
`stale_by_day` bundle then shows both flags side by side. Acceptance: on
weekdays the two agree; on weekends the new flag is false while the provider
timestamp is unchanged. Only then swap `_is_stale_timestamp` to the calendar
version, keeping a genuine provider-stall test (no new bar within N sessions).
This is the single change with the largest user-visible effect on Monday
mornings and it changes no verdict on fresh data.

**Step 2 — separate the setup class from the verdict (candidate v2, shadow).**
In `candidate_decision.py`, stop reading `recommendation_quality` (it carries
the −25) and stop deriving `setup_class` from `setup_detail` text; classify
from `trend / momentum / breakout / volume / avwap` directly, with AVOID
replaced by `NONE` plus reason codes, and compute a `quality_ex_setup` score
without the double count. Persist as the existing `candidate_*` columns
(bump `candidate_config.version`). The relay bundles already measure it.

**Step 3 — accumulate.** ≥ 10 trading days of fresh-window shadow rows joined
to `forward_returns` at 5D/10D/20D. Acceptance gates before any switch:
`enter_already_expanded = 0` on every run; candidate ENTER rate between 0.5%
and 5% of fresh rows (a candidate that says ENTER more often is not better);
no ENTER with a severe veto or on stale data; 10D mean and median ≥ the
fresh-window baseline with hit rate ≥ 55%; 20D p10 not worse than baseline;
per-symbol clustering respected as in the holdout study.

**Step 4 — staged switch.** (a) `prod_fast_scan` dry-run into an isolated
outdir with `SCANNER_DECISION_MODE=candidate` and compare the two rankings
offline; (b) one live scan in candidate mode with the rollback tag taken and
`/terminal`, `/discover`, paper trading and alerts watched for that run; (c)
leave it on only if the run matches the shadow numbers. Rollback = unset the
variable; no image change is involved in either direction.

**Step 5 — product semantics (separate decision).** `EXIT` for an unheld
symbol should read as "no entry / sell signal" and be reserved for held
positions (paper or user-declared). This is copy and routing, not the engine,
and should not ride the mode switch.

Out of scope, deliberately: editing the `≥ 80` floor in place (the holdout
study argued against a threshold edit without shadow evidence, and nothing
here contradicts it).

## 7. Fresh-market shadow readings (first three fresh runs, PROD HOST)

Continued in `scanner-decision-engine-p1-1-24h-followup-20260915.md` (per-run
log, v2 shadow, replay). Headline: the first fresh run (4984a236, 13:47 UTC,
355 rows, STALE_DATA 0) gave live `ENTER 0 / WAIT 10 / WATCH 31 / AVOID 89 /
EXIT 225`, setup `AVOID 297 / PULLBACK 57 / CONTINUATION 1 / BREAKOUT 0`, and
the deployed candidate `ENTER 0 / WATCH 51 / AVOID 79 / EXIT 225` — its 130
non-EXIT rows fell to severe vetoes (75: POOR_RISK_REWARD / STOP_RISK /
EXTREME_VOLATILITY), `pre_expansion < 45` (38), action ≠ BUY (12) and five
others; nothing reached the band test. The next two runs (e761abcc 14:02,
2c1b2412 14:17) were within a few rows of the same picture (v1 ENTER 1 each).
Observation-only `mcal_*` and `candidate_v2_*` columns went live from the
13:56 scan; on the same rows v2 said ENTER 3 / WAIT_PULLBACK 20 (14:02) and
2 / 20 (14:17) with zone, stop and target on every one. The decision in §0
stands: `current` stays live.

## 8. P2-4 — the 10:24 UTC host reboot (closed)

PROD HOST via `prod_journal_recent`: `sudo[2460843]: sre : TTY=pts/0 ;
COMMAND=/usr/sbin/reboot` at 10:24:22 UTC, then `systemd-logind: System is
rebooting`, a clean `systemd-reboot.service` sequence and journal stop at
10:24:27; new boot at 10:24:42 on kernel 6.8.0-139 (previous boot 6.8.0-124,
94 days up). `tradeveto-resource-watchdog` reported `status=ok findings=0
alert=not_needed` at every 5-minute tick through 10:21:59 and again from
11:21:57 onward; unattended-upgrades found no packages on 09-12/13/14 and did
not request a reboot. Containers restarted 10:24:47 with `RestartCount=0`
(frontend, hot-api, postgres, caddy). The reboot was an operator action from
an interactive SSH session, not a fault; the pending kernel was activated by
it. No follow-up needed beyond noting that `-p warning` journals on this host
are dominated by `[UFW BLOCK]` lines, which the relay action now filters.
