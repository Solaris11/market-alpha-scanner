# STALE_DATA now follows the market calendar — production fix (2026-09-15)

Environment labels: **PROD HOST** = production box through the guarded relay
(Postgres, docker, systemd, journal); **PROD WEB** = https://tradeveto.com;
**LOCAL MAC** = repo, tests and typecheck only, never production evidence.

Order of work: the `docker-memory` critical on the scanner job container was
triaged first and is written up separately in
`docs/ops/resource-alert-docker-memory-scanner-job-20260915.md`. It was
classified as a real near-limit spike in the DB-write phase with no failure, no
host risk and no deploy required, so it did not block this change. The image
rebuild below carries only the freshness fix.

## 1. Root cause

`scanner/diagnostics.py::data_quality_flags` decided freshness with a 36-hour
wall clock on the last bar's timestamp (`_is_stale_timestamp`, `STALE_DATA_HOURS`).
Daily bars are stamped with the session's date, so the previous session's bar
crosses 36 hours every normal weekday around noon UTC — before the US market has
even opened. Friday's bar is "stale" from Saturday noon onwards, and every Monday
pre-open. The flag is not cosmetic: `STALE_DATA` is a severe veto, it carries a
−30 data-quality penalty which then trips `LOW_CONFIDENCE_DATA`, and both block
`trade_permitted` and depress confidence.

Measured on PROD HOST, three consecutive pre-open runs today (12:46, 13:01,
13:16 UTC), 352 rows each:

| run (UTC) | rows | STALE_DATA veto | market-calendar stale | LOW_CONFIDENCE_DATA | median data_quality |
|---|---|---|---|---|---|
| 12:46 | 352 | 197 | 0 | 197 | 65.0 |
| 13:01 | 352 | 197 | 0 | 197 | 65.0 |
| 13:16 | 352 | 197 | 0 | 197 | 65.0 |

197 of 352 symbols were vetoed as stale while every one of them was current by
the market calendar (0 missed sessions). The remaining 155 were already carrying
today's bar from the other provider. After the 13:30 open the flag cleared by
itself as bars refreshed (13:33: 69, 13:47: 0) — which is exactly the signature
of a clock bug rather than a data problem.

## 2. The change

`data_quality_flags` now derives the live `stale_data` from the market-calendar
test that had been shipping in observation mode:

- `missed_closed_sessions(timestamp)` counts weekday sessions that have *closed*
  since the bar without a newer bar arriving. Weekend days and the session in
  progress count for nothing.
- `_is_stale_by_market_calendar` is true when more than `MAX_MISSED_SESSIONS`
  (1) sessions were missed, or when the bar is older than
  `MAX_CALENDAR_DAYS_ANY_MARKET` (5.0 days), which catches markets that never
  close (crypto, FX proxies).
- The old wall-clock answer is kept and persisted as `stale_by_wall_clock`.
  Nothing reads it; it exists so the two clocks can be compared on production
  rows.
- `data_quality_flags(row, now=...)` and `_is_stale_timestamp(value, now=...)`
  take an optional clock so each calendar scenario is testable deterministically.

Tolerating exactly one missed close is deliberate: it absorbs a single-session
holiday and a provider that skips one session, while a provider that stalls for
two sessions is still severe. Known limitation: a two-day market holiday
(Thanksgiving Thursday + Friday) would read as stale on the following morning.
A real exchange holiday calendar is the follow-up; it is not needed for the
common case and was left out to keep this change narrow.

**Explicitly out of scope, unchanged:** candidate v2 stays shadow-only
(`SCANNER_DECISION_MODE=current`), the score floor, `setup_type` classification,
risk/reward, SELL→EXIT mapping and the frontend's scan-age stale disclosure
(`frontend/src/lib/stale-data-safety.ts`, 240-minute scan freshness) are all
untouched.

## 3. Tests (LOCAL MAC)

`tests/test_scanner_diagnostics.py`, 34 tests, all passing, including the new
`LiveStaleGateUsesMarketCalendarTests`:

- Friday bar seen on Monday pre-open is not stale, no `STALE_DATA`, no
  `LOW_CONFIDENCE_DATA`, and the data-quality score equals that of the same row
  with a bar from today (no −30) — while `stale_by_wall_clock` is true.
- Saturday and Sunday: not stale.
- Tuesday pre-open with Friday's bar (Monday closed without a bar — holiday or a
  skipped session): `missed_sessions == 1`, not stale.
- Wednesday pre-open with the same bar: `missed_sessions == 2`, stale, veto
  present, data-quality at or below 70.
- A genuinely old bar (26 days) is stale by both clocks.
- A current bar produces an empty veto list.
- `stale_by_wall_clock` is reported and flipping it changes no veto.
- Persisted columns follow the calendar gate and the `mcal_*` observation
  columns now mirror the live list (a divergence there would mean the live gate
  drifted away from the calendar again).

Also green: `tests/test_candidate_decision.py` (55), `tests/test_decision_funnel.py`
(12), `tests/test_shadow_decision.py` (15), `tests/test_scanner_safety.py` (7),
`tests/test_market_data_provider.py` (10), `tests/test_forward_validation.py` (7),
`tests/test_scanner_drop_reasons.py` (3), `tests/test_scanner_outputs.py` (1).

## 4. Deploy and verification (PROD HOST)

1. Commit `ea3b849b`, pushed through the relay, `prod_pull` → prod HEAD
   `ea3b849b`.
2. `prod_scanner_build` with rollback tag
   `rollback-scanner-20260915-stale-mcal` (tags the previous `latest`, built
   from `3eb0ca73`, before rebuilding). Build stamp confirms
   `commit=ea3b849b8e140276cfc823fad8f1390d7e930c0c`.
3. No controlled scan was forced: the 13:57:11 UTC fast-scan timer picked up the
   new image (`scanner-image-freshness` logged the new commit subject) and
   completed at 14:03:14 with `scan_runs=1, scanner_signals=352`,
   `total_runtime 360.4s`, lock released, exit 0.

Flag state, last six runs (PROD HOST, `stale_flags_latest`):

| run (UTC) | rows | STALE_DATA veto | live stale flag | mcal stale | wall-clock stale | rows carrying wall-clock field | missed 0 / 1 / 2+ | LOW_CONF | median DQ |
|---|---|---|---|---|---|---|---|---|---|
| 14:02 | 352 | 0 | 0 | 0 | 0 | 352 | 352 / 0 / 0 | 0 | 95.0 |
| 13:47 | 352 | 0 | 0 | 0 | 0 | 0 | 352 / 0 / 0 | 0 | 95.0 |
| 13:33 | 352 | 69 | 69 | 0 | 0 | 0 | 352 / 0 / 0 | 69 | 95.0 |
| 13:16 | 352 | 197 | 197 | 0 | 0 | 0 | 352 / 0 / 0 | 197 | 65.0 |
| 13:01 | 352 | 197 | 197 | 0 | 0 | 0 | 352 / 0 / 0 | 197 | 65.0 |
| 12:46 | 352 | 197 | 197 | 0 | 0 | 0 | 352 / 0 / 0 | 197 | 65.0 |

The 14:02 run is the first on the new image: `stale_by_wall_clock` is persisted
for all 352 rows (it is absent on every earlier run), and the live flag now
equals the market-calendar flag. Both are zero at 14:02 only because the market
has been open since 13:30 and every bar is current; the pre-open false positives
the fix targets are re-measured tomorrow morning (see §6).

Decision distribution across the same runs (rows=352 each):

| run (UTC) | EXIT | AVOID | WATCH | WAIT_PULLBACK | median confidence | median final score |
|---|---|---|---|---|---|---|
| 14:02 (new) | 217 | 94 | 34 | 7 | 59.8 | 43.3 |
| 13:47 | 214 | 97 | 34 | 7 | 61.8 | 42.1 |
| 13:33 | 194 | 110 | 27 | 21 | 54.8 | 46.5 |
| 13:16 | 193 | 121 | 25 | 13 | 27.2 | 46.8 |

The 14:02 distribution sits within the run-to-run spread of the 13:47 run that
preceded it on the old image, so the deploy introduced no step change of its own;
the visible move (median confidence 27 → 60, median data quality 65 → 95) happened
at the open, when the false stale flags cleared. ENTER stays 0 in live and the
shadow (`shadow rule=floor live_enter=0 shadow_enter=0 differs=0`), and candidate
v2 stays shadow-only at `EXIT=217 WATCH=60 AVOID=54 WAIT_PULLBACK=20 ENTER=1`.

Smoke (PROD HOST → public routes), all 200 unless noted:
`/api/health` 200, `/api/health/deep` 200, `/terminal` 200 (107 KB, ttfb 0.11s),
`/discover` 200, `/opportunities` 200, `/pricing` 200, `/account` 200,
`/symbol/{AMD,NVDA,OXY,SNDK}` 200, `/api/terminal/market-charts` 401 (expected:
entitlement-gated). Journal after the run: no traceback, service
`Deactivated successfully`, no container restarts, host memory unchanged.

## 5. Rollback

`docker tag market-alpha-scanner-market-alpha-scanner-job:rollback-scanner-20260915-stale-mcal market-alpha-scanner-market-alpha-scanner-job:latest`
and let the next fast-scan timer pick it up; the previous image is built from
`3eb0ca73`. Triggers to roll back: STALE_DATA at zero while a provider is
visibly stalled (bars not advancing for two or more sessions), any jump in
`ENTER` in the live mode, or a scan failing to write rows. None of these
appeared on the 14:02 run.

## 6. What is still open

- **Tomorrow's pre-open runs (11:30–13:30 UTC) are the real acceptance test.**
  Expected: `STALE_DATA` 0 where `missed_sessions ≤ 1`, median data quality ~95
  instead of 65, and `stale_by_wall_clock` still true for a large share of rows
  — that difference is the bug this fix removes, now visible as data rather than
  as a veto.
- Exchange holiday calendar, so a two-session holiday closure is not read as a
  provider stall.
- The candidate v2 comparison continues in shadow; the live decision mode stays
  `current`. Nothing in this change moves it.
