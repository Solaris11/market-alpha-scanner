# RCA — SNDK absent from every production scan for 35 days

**Severity** P0 · **Status** CLOSED — resolved, verified on a full `--run-analysis`
scan, and accepted by the owner 2026-09-11 · **Author** autonomous session

## Incident summary

SNDK (Sandisk Corporation) was added to the scanner universe on 2026-08-06 and
never appeared in a single production scan afterwards. It produced zero rows in
`scanner_signals`, zero bars in `symbol_price_history` and zero rows in
`forward_returns`. `/symbol/SNDK` had no data to render.

The symbol was not rejected, filtered or vetoed. It was never a candidate. The
scheduled scanner runs from a container image built on **2026-06-10**, and the
`Dockerfile` bakes the universe data into that image with `COPY . /app`. The
running container therefore carried the June universe file, which does not
contain SNDK. The repository was correct the entire time.

Nothing was wrong with the code, the data file, the provider, or the database.
The deployed artifact was 57 days older than the data it was supposed to carry.

## Business impact

- **35 days** with a promised symbol silently absent (2026-08-06 → 2026-09-10).
- `/symbol/SNDK` returned no intelligence for any user who looked it up. This
  was the *only* symptom, and it surfaced through a user report rather than any
  internal signal.
- SNDK moved from **$50.82 to $1,696.81** (33.4×, +3238.85%) during the window
  the platform was blind to it. A WAIT-first product that silently omits a
  33-bagger from its universe is failing at precisely the job it claims.
- No shared watchlist referenced SNDK (`0` rows), so no alert or watchlist
  feature misfired. Blast radius was confined to symbol lookup and universe
  coverage.
- No incorrect data was ever shown. The failure mode was absence, not error —
  which is why nothing detected it.

## Timeline

| When (UTC) | What |
|---|---|
| 2026-06-10 00:27:02 | scanner-job image built (`c821887f`). Last rebuild before the incident. |
| 2026-08-06 | `f283d5ca` adds SNDK to `scanner/data/opportunity_universe_1000.csv` **and** to `REQUIRED_OPPORTUNITY_SYMBOLS`. Repo now correct; image already 57 days stale. |
| 2026-08-06 → 2026-09-10 | Every scheduled scan (every 15 min, plus a daily full scan) runs the June image. SNDK never selected. No warning, no drop reason, no log line. |
| 2026-09-03 | `c472bbc4` adds `warn_missing_required_symbols()` and calls it every run. **Never reaches production** — it lives in the same image that is not being rebuilt. |
| 2026-09-10 13:21 | Image creation date confirmed as 2026-06-10; universe CSV last changed 2026-08-06. |
| 2026-09-10 13:24 | Proof from *inside* the running image: SNDK absent from the CSV, from `REQUIRED_OPPORTUNITY_SYMBOLS`, and from `build_universe('500')`. |
| 2026-09-10 13:26 | Rollback tag `rollback-20260910a` taken (`c821887f`). |
| 2026-09-10 13:28:38 | Image rebuilt (`c4eb528c`) from prod checkout `80197b38`. |
| 2026-09-10 13:38:06 | First scheduled scan on the new image writes the **first SNDK row in the platform's history**. |
| 2026-09-10 13:41–13:54 | Full 500-symbol dry run into an isolated outdir, no database. SNDK ranked #150 of 354. |
| 2026-09-10 14:00:20 | Second scheduled scan confirms SNDK persisting normally. |
| 2026-09-10 14:07 | `/symbol/SNDK` verified live in the browser. |

## Root cause

**The scheduled scanner runs a container image that no deployment path ever
rebuilds, and the universe data is baked into that image at build time.**

Two facts combine:

```dockerfile
COPY . /app          # Dockerfile — universe CSV becomes part of the image
```
```yaml
volumes:             # compose.yaml — only outputs are mounted
  - /opt/apps/market-alpha-scanner/runtime/scanner_output:/app/scanner_output
  - /opt/apps/market-alpha-scanner/runtime/logs:/app/logs
```

The systemd unit invokes `docker compose run --rm market-alpha-scanner-job`,
which resolves the service to whatever `:latest` already exists on the host and
**never builds**. `git pull` on the host updates the repository, the frontend
containers get rebuilt on deploy, and the scanner-job image is simply left
behind — indefinitely.

Measured proof, executed inside the image that was actually serving production:

```
required 13 False          <- SNDK not in REQUIRED_OPPORTUNITY_SYMBOLS
has_warn False             <- the detector for this bug is not in the image either
csv_rows 1000 SNDK_in_csv False
u500 500 SNDK_in_u500 False
```

The same command against the rebuilt image:

```
required 14 True
has_warn True
csv_rows 1001 SNDK_in_csv True
u500 500 SNDK_in_u500 True
```

## Contributing factors

1. **The universe is build-time data, not runtime data.** Every other input the
   scanner uses (prices, fundamentals, news) is fetched at run time and cannot
   go stale this way. The universe is the one input frozen into the artifact,
   and it is also the one input that decides what exists at all.
2. **No image-age signal anywhere.** Nothing logged the image build date, and
   nothing compared it to the checkout it was supposedly running.
3. **A 92-day-old image was not treated as remarkable.** It had been flagged in
   an earlier assessment (`docs/ops/sndk-scanner-job-rebuild-assessment.md`,
   2026-09-04) as "86 days old", with a rebuild recommended and not executed.
   The assessment correctly identified the risk six days before this RCA and
   the rebuild was deferred.
4. **Deploys are frontend-shaped.** The runbook's mental model is "pull, rebuild
   frontend, restart". The scanner-job sits behind `--profile scanner-job` and
   is invisible to that flow.

## Detection gap

**`scanner_drop_reasons.csv` can only account for symbols that were selected.**
It is an excellent ledger — `selected=500 accounted=500 ranked=354 unknown=0` —
but its universe *is* the selected set. A symbol that never entered the universe
produces no row in it, no log line, and no database artifact. It leaves no
negative space. That is the precise mechanism by which SNDK vanished silently
rather than loudly.

There was no monitor asserting "the symbols we promised to cover are present in
today's scan", and no alert on universe size or composition changing.

## Why it escaped

The detector for exactly this failure was written, tested, merged — and then
neutralised by the very bug it was written to catch.

`missing_required_symbols()` existed and was covered by tests well before the
incident. On 2026-09-03 it was wired into every scan by `c472bbc4`. But that
call lives in `investment_scanner_mvp.py`, inside the image, and the image is
what was never rebuilt. The guard sat in the repository, passing its tests in
CI, unable to run in production. `has_warn False` above is that fact measured.

The lesson is narrower and sharper than "add monitoring": **a guard that ships
inside the artifact it is meant to validate cannot detect a stale artifact.**

## Fix

1. **Rollback tag first.** `market-alpha-scanner-market-alpha-scanner-job:rollback-20260910a`
   → `sha256:c821887f…` (the 2026-06-10 image), taken before any build.
2. **Rebuilt the scanner-job image** from prod checkout `80197b38`, producing
   `sha256:c4eb528c…` at 2026-09-10T13:28:38Z. This alone resolves the incident:
   the systemd unit resolves `:latest` at run time, so the next scheduled scan
   picked up the new image with no unit change and no restart required.
3. **The guard is now live** as a side effect of the same rebuild, so the next
   stale deployment announces itself in the scan log on its first run.

No code change was required to fix the incident. The repository was already
correct; only the artifact was stale.

## Verification evidence

**Before — database, all-time:**

```
scanner_signals   for SNDK : 0 rows
symbol_price_history        : 0 bars
forward_returns             : 0 rows
```

The control group makes the cause unambiguous. All 13 *other*
`REQUIRED_OPPORTUNITY_SYMBOLS` were present throughout, 7,311–12,123 signals
each; SNDK alone was at zero, and SNDK alone was added after the image build:

```
APP 12123 · ASTS 7529 · HIMS 7491 · IONQ 7435 · LITE 7435 · LUNR 7404
PL 7520 · QBTS 7524 · QUBT 7412 · RGTI 7506 · RKLB 7531 · SOUN 7398 · TEM 7311
SNDK 0
```

**Dry run** — full 500-symbol scan, isolated output directory, database disabled
via `-e DATABASE_URL=` (`Skipping database write: DATABASE_URL not configured`):

```
[universe] selected 500 symbols
[scanner] accounting: selected=500 accounted=500 ranked=354 unknown=0
```

No `[universe] WARNING required symbols missing` line — all 14 required symbols
present. SNDK ranked #150 of 354, and explicitly accounted for in the ledger:

```
117,SNDK,ranked,ranked and included in full_ranking.csv,395,2026-09-10T04:00:00+00:00,alpaca,...,46.78
```

**After — two real scheduled scans:**

```
SNDK | EXIT | 46.72 | AVOID | OVEREXTENDED | AVOID | rr=3.01 | 1696.81 | 2026-09-10 14:00:20
SNDK | EXIT | 46.46 | AVOID | OVEREXTENDED | AVOID | rr=3.05 | 1694.35 | 2026-09-10 13:38:06
```

`symbol_price_history` backfilled to 260 bars (2025-08-28 → 2026-09-10).

**Frontend** — `/symbol/SNDK` renders "SYMBOL READY", $1,696.81, DECISION EXIT,
Score 47, "Updated 7 min ago"; search returns it on exact ticker and company
name match.

**One figure checked rather than assumed.** The symbol page shows
**+3238.85%**, which looks like a defect. It is correct: SNDK's stored history
runs from a $50.82 close on 2025-08-28 to $1,696.81, a 33.4× move. That also
explains the verdict — `EXTREME_VOLATILITY`, `OVEREXTENDED_ENTRY`, `EXIT` is a
coherent read of a stock up 33× in twelve months, not a malfunction.

**Tests** — 11 universe tests pass, including
`test_the_sndk_case_reproduced` ("the exact production state: everything present
except SNDK").

## Follow-up: the 21:30 full scan on the rebuilt image

The rebuild moved the scanner three months of code in one step as an incident
fix, and the fast scan does not exercise `--run-analysis`. This was the first
full scan on the new image and it was watched deliberately.

**2026-09-10 21:30:01 → 21:36:52 UTC. `Result=success`, `ExecMainStatus=0`,
`NRestarts=0`. 411 s wall, 405.9 s by the scanner's own timer.**

Image identity verified from the running container rather than its tag:

```
container_image=sha256:c4eb528ca7859333c1ebba5a1cfdc00a6b7971359a87b5bf1522e05534d9d96c
```

That is byte-identical to `:latest`, and `rollback-20260910a`
(`sha256:c821887f…`, 2026-06-10) is untouched.

| Check | Result |
|---|---|
| Universe | `[universe] selected 500 symbols` |
| Required-symbols guard | **no WARNING line** — all 14 present, SNDK included |
| Accounting | `selected=500 accounted=500 ranked=353 unknown=0` |
| Ranked rows | 353, inside the 351–354 fast-scan band |
| Decision spread | EXIT 214 · AVOID 92 · WATCH 40 · WAIT_PULLBACK 7 = 353 |
| Errors / exceptions | none; no traceback |
| Analysis phase | `forward_returns.csv` 1.3 MB + calibration outputs at 21:36; **5,371 `forward_returns` rows written to the database at 21:36:44** |
| Timers after | fast-scan ran again at 21:40:07; full-scan next Fri 21:30; `run.lock` held by the live 21:40 run, not stale |

SNDK left a trace in all three places it should:

```
scanner_drop_reasons.csv:118  117,SNDK,ranked,ranked and included in full_ranking.csv,395,...,alpaca,...,47.65
full_ranking.csv:153          SNDK,Sandisk Corporation,EQUITY,Technology,Computer Hardware,1691.695,...
scanner_signals               SNDK | AVOID | 47.65 | AVOID | OVEREXTENDED | AVOID | rr 3.09 | 1691.695 | 21:35:00
```

`/symbol/SNDK` now renders **Fresh** rather than the "Slightly stale" it showed
at 14:07: $1,691.70, DECISION AVOID, Score 48 — matching the database row
exactly. Over the day SNDK accumulated 31 signal rows and 260 price bars from a
standing start of zero.

Two observations that are not faults:

- **Four symbols log provider warnings** — ACLX, APLS, FOLD and FDP return
  "possibly delisted; no price data found" from Yahoo. These are warnings, not
  exceptions, and they are accounted for in the drop-reason ledger rather than
  vanishing. Worth a separate universe-hygiene pass; unrelated to this incident.
- **SNDK still has 0 `forward_returns` rows.** Expected: forward returns need a
  prior signal date and a maturation window, and SNDK's first signal is today.
  It will populate from tomorrow.

Housekeeping left behind: `runtime/scanner_output/dryrun-20260910{a,b,c}` are
this investigation's isolated dry-run directories. They are inside the runtime
output volume, contain no user data, and can be removed at any time.

**The acceptance criteria are met on a real `--run-analysis` run, not only on
the fast scan.**

## Rollback plan

Single command, no data implications — the scanner-job image is stateless and
its only outputs are CSVs and database rows:

```
docker tag market-alpha-scanner-market-alpha-scanner-job:rollback-20260910a \
          market-alpha-scanner-market-alpha-scanner-job:latest
```

The next scheduled run picks the restored image up automatically. Rolling back
returns production to the 2026-06-10 image and would re-introduce the incident,
so it is only appropriate if the new image causes a worse failure. Two scheduled
scans have already completed on the new image with `unknown=0` and normal row
counts (351 symbols persisted in the latest run).

## Preventive actions

| # | Action | Status |
|---|---|---|
| 1 | `warn_missing_required_symbols()` runs on every scan and names any promised symbol absent from the universe | **Live** — shipped with the rebuild; verified twice by its silence, on the dry run and on the 21:30 full scan |
| 2 | Rebuild `market-alpha-scanner-job` as an explicit, mandatory step of every deploy | **Documented** — `docs/ops/scanner-job-deploy-runbook.md`, plus a warning at the top of the actionability runbook. Not enforced by tooling |
| 3 | Compare the image against the checkout from *outside* the image | **Written and tested, not wired** — `tools/ops/scanner-image-freshness.sh`. Run against the incident's real values it returns `STALE BY 88 days, status fail, exit 1`; against today's image, `status ok`. The `Dockerfile`/`compose.yaml` build stamp that makes the comparison commit-exact ships with it and is exercised by the next rebuild |
| 4 | Monitor for the `[universe] WARNING` line and alert on it | **Open** |
| 5 | Alert when a scan's universe size or required-symbol count changes unexpectedly | **Open** |
| 6 | `ExecStartPre=-…/scanner-image-freshness.sh --warn-days 7` on both scan units, and a daily timer running it with `--fail-days 30` | **Open** — needs a privileged write to `/etc/systemd` that the read-only relay correctly refuses |

**Honest summary of where the defence stands.** One guard is live and has now
proven itself twice. A second, deliberately outside the image, exists and is
tested but is wired to nothing — it will only run when somebody runs it. So a
recurrence would today be *loud in the scan log* rather than silent, which is
the important half; but nothing yet stops the image going stale, and nothing
pages anyone if the warning fires at 03:00. Actions 4–6 are what close that.

Action 3 deserves care. Putting a staleness check inside the image repeats the
exact mistake this incident is about. The check belongs in the systemd unit or
the deploy runbook — something that compares the image's creation timestamp to
the checkout's `HEAD` date *before* invoking the container.

## Tests, monitoring and runbook updates

- **Tests**: `tests/test_required_symbol_warning.py` already reproduces the
  production state exactly and passes. No new test is required for the fix
  itself; the gap was never test coverage, it was artifact delivery.
- **Monitoring**: nothing currently watches scan logs for the universe warning.
  Actions 4 and 5 above are unimplemented.
- **Runbook**: `docs/ops/deploy-runbook-actionability.md` describes a frontend
  deploy and does not mention the scanner-job image at all. It needs a
  mandatory rebuild step. `docs/ops/sndk-scanner-job-rebuild-assessment.md`
  (2026-09-04) recommended this rebuild six days before the RCA and should be
  closed out against this document.

## Remaining risks

1. **Preventive actions 2–5 are not implemented.** The incident is fixed and the
   guard is live, so a recurrence would now be *loud* rather than silent — but
   nothing yet prevents the image going stale again, and nothing alerts on the
   warning if it fires at 03:00.
2. **Any other build-time data has the same exposure.** The universe CSV was the
   one that bit us; the audit of what else `COPY . /app` freezes has not been
   done.
3. **The 92-day gap means more than SNDK changed.** The rebuild moved the
   scanner from 2026-06-10 code to 2026-09-04 code in one step. Two scheduled
   scans look healthy (`unknown=0`, 351 symbols persisted, normal decision
   spread), but this was a three-month code jump executed as an incident fix,
   not a reviewed deploy. The next full scan (Mon–Fri 21:30, with
   `--run-analysis`) exercises paths the fast scan does not and has not yet run
   on the new image.
4. **Prod checkout remains `80197b38` on `release/success-rate-units`**, not
   `origin/main`. Safe — `origin/main` is an ancestor — but the divergence is
   now baked into a freshly built scanner image as well as the frontend.
5. **SNDK's own history is thin.** 260 bars starting 2025-08-28, and the symbol
   has 0 forward-return rows so far. Any evidence-maturity or history-derived
   display for SNDK will read as sparse until the backfill deepens.
