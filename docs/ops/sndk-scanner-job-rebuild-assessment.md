# SNDK: what a scanner-job rebuild would actually change

Written 2026-09-04, read-only. **Not executed.** Awaiting your approval, with
the reasoning below so the decision is on evidence rather than on my word.

## Root cause, confirmed on the host

```
market-alpha-scanner-market-alpha-scanner-job:latest   2026-06-10 00:27:02 UTC   1.85GB
```

86 days old. SNDK entered the universe after that date, so the running image
does not contain it. The scans themselves are healthy and current — they run as
systemd timers, not as a long-lived container:

| Timer | Cadence | Last run |
|---|---|---|
| `market-alpha-fast-scan.timer` | every 15 min | 2026-09-04 02:30:31 UTC |
| `market-alpha-full-scan.timer` | daily 21:30 UTC | 2026-09-03 21:30:01 UTC |

Both override `ExecStart` to run the job image:

```
/usr/bin/docker compose --env-file .../.env -f .../compose.yaml --profile scanner-job \
  run --rm market-alpha-scanner-job \
  python investment_scanner_mvp.py --fast --timing --outdir /app/scanner_output
```

## Dependency drift: smaller than it looks

`requirements.txt` at the image's build commit (`3113a396`, 2026-05-08) is
**byte-identical** to `requirements.txt` on `main` today. Verified by diff.

Everything that touches scan arithmetic is exact-pinned and unchanged:

| Package | Pin |
|---|---|
| `numpy` | `==2.4.4` |
| `pandas` | `==3.0.2` |
| `yfinance` | `==1.3.0` |

The unpinned entries — `fastapi`, `uvicorn[standard]`, `streamlit>=1.37` — are
not on the scan execution path. The job's command is
`python investment_scanner_mvp.py`; the Dockerfile's `CMD` (streamlit) is
overridden and never runs, and no FastAPI app is started by the scan.
`SQLAlchemy`, `alembic`, `psycopg` and `psycopg2-binary` all carry upper
bounds.

**The one real unknown is the base image.** `FROM python:3.12-slim` is an
unpinned tag, so a rebuild pulls three months of Python patch releases and
Debian base updates. Nothing in that set is known to change numeric behaviour,
and the wheels above are manylinux, but it is the part I cannot rule out by
reading.

## Application drift: three commits, one of them behavioural

`git diff 9ca8309f..main` restricted to the scanner:

```
 investment_scanner_mvp.py                  |  3 ++-
 scanner/analysis.py                        |  8 ++++++--
 scanner/data/opportunity_universe_1000.csv |  7 ++++---
 scanner/universe.py                        | 28 ++++++++++++++++++++++++++++
 scanner/universe_foundation.py             |  7 ++++---
 5 files changed, 44 insertions(+), 9 deletions(-)
```

- **`scanner/analysis.py`** — hoists one `payload: dict[str, object]`
  declaration out of two branches. A type-annotation refactor with no runtime
  effect whatsoever.
- **`scanner/universe_foundation.py` and the universe CSV** — SNDK added to
  `LARGE_CAP_SYMBOLS`, to `SEMICONDUCTOR_SYMBOLS`, and as a
  `required_opportunity` row. This is the fix.
- **`scanner/universe.py` + `investment_scanner_mvp.py`** — `warn_missing_required_symbols`,
  which logs when a required symbol does not survive into a scan. A warning; it
  does not filter or alter the universe.

So the rebuild's behavioural surface is: SNDK appears, and the scan starts
saying so when a required symbol goes missing. That is a much smaller blast
radius than "86 days of drift" suggests.

## One cosmetic defect found while checking this

The universe CSV is CRLF throughout (998 of 1002 lines). The SNDK edit wrote
four LF-only lines into the middle of it — IONQ, LITE, SNDK, RKLB.

It is harmless. `load_expanded_universe_rows` opens with `newline=""` and uses
`csv.DictReader`, which handles mixed terminators itself, and both fields are
stripped afterwards. I am **not** normalizing it: rewriting line endings in a
1,000-row data file is a large diff with a nonzero chance of changing something,
for no benefit. Recorded here so it is known rather than rediscovered.

## Why I did not run the dry-run

The relay is the only path from this session to production, and it refuses both
halves of the operation by design: `docker compose build` is allowed only for
the two frontend services (the allowlist pins the service names), and
`docker ... run` is denied outright. Neither is something I should widen on my
own initiative — that allowlist is the safety boundary, not an obstacle.

The good news is the service definition already supports a dry-run cleanly,
because `--outdir` is a first-class flag.

## Recommendation

**Rebuild, after a dry-run.** The dependency risk is close to nil and the code
delta is three commits of which one is a no-op. The base-image tag is the only
thing I cannot verify by reading, and the dry-run is what settles it.

If the dry-run's output matches the current scan on the symbols that already
work, and adds SNDK, the rebuild is safe.

### Exact sequence, for when you run it

```bash
cd /opt/apps/market-alpha-scanner/app
git pull --ff-only origin main            # SNDK must be in the checkout first

# 1. Keep a rollback target for the image that is working today.
docker tag market-alpha-scanner-market-alpha-scanner-job:latest \
           market-alpha-scanner-market-alpha-scanner-job:rollback-20260604

# 2. Build.
docker compose --env-file .env --profile scanner-job build market-alpha-scanner-job

# 3. Dry-run into a directory nothing reads.
docker compose --env-file .env -f compose.yaml --profile scanner-job \
  run --rm market-alpha-scanner-job \
  python investment_scanner_mvp.py --fast --timing --outdir /app/scanner_output_dryrun
```

### Acceptance criteria for the dry-run

1. Exit code 0.
2. SNDK present in the dry-run output with a populated row, not a null shell.
3. Row count within ±2% of the current scan's 356.
4. The decision distribution is not wildly different from `EXIT 182 · AVOID 158
   · WATCH 14 · WAIT_PULLBACK 2`. A large shift means something other than SNDK
   changed and the rebuild should stop.
5. Spot-check three symbols that already work (AMD, NVDA, IREN): price and
   score within rounding of the current scan.
6. No new warnings beyond the expected `warn_missing_required_symbols` output.

### Rollback

The scans are oneshot timer units, so there is no running container to revert.
Rollback is one tag move plus letting the next timer fire:

```bash
docker tag market-alpha-scanner-market-alpha-scanner-job:rollback-20260604 \
           market-alpha-scanner-market-alpha-scanner-job:latest
```

Nothing needs restarting, and the dry-run directory can be deleted without
touching `scanner_output`.

## Unrelated finding: image disk

Ten `rollback-*` frontend tag pairs are on the host, each 1.5 GB — roughly
15 GB of images for rollbacks going back to 2026-09-01. The günlük already
tracks disk growth as an open item; this is a concrete, safe place to reclaim
space once the current deploy is proven. I have not deleted anything.
