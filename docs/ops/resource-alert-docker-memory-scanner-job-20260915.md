# Resource alert RCA — docker-memory on the scanner job container (2026-09-15)

Environment labels: **PROD HOST** = the production box reached through the guarded
command relay (docker, systemd, journal, cgroups); **LOCAL MAC** = repo/code
reading, never presented as production evidence.

## 1. The alert

```
2026-09-15T11:47:13Z CRITICAL docker-memory:market-alpha-scanner-market-alpha-scanner-job-run-66e1ee60d860
value=94.37 threshold=85.0
host: cpu 5.39% | mem 23.45% | swap 5.18% | tcp 53
```

Source: `tradeveto-resource-watchdog.service`, a systemd oneshot on a 5-minute
timer. Its `docker_metrics` step runs `docker stats --no-stream` and raises a
critical finding for any running container whose `MemPerc` — usage against *its
own* limit, not the host's — reaches `TRADEVETO_RESOURCE_DOCKER_MEM_CRITICAL_PERCENT`
(default 85.0). The named container is a one-shot `compose run --rm` job: the
fast scan. It exists only for the ~5 minutes of a scan and is removed on exit,
which is why no container with that name can be inspected after the fact.

## 2. What was measured (PROD HOST)

Watchdog ticks that fired critical, all on 2026-09-15: 10:32:16, 11:17:15,
11:47:16, 13:17:16. Every other tick in the same period reported
`status=ok findings=0`. Each critical tick falls inside the closing seconds of a
fast scan; ticks that land anywhere else in the scan see a few hundred MiB.

Because the container is removed on exit, a read-only relay action
(`prod_scanner_job_watch`) was added to sample the job's cgroup every 3 s.
Two scans were sampled end to end. The 13:42:11 scan (completed 13:47:59,
`scan_runs=1, scanner_signals=352`):

```
13:42:38  cur=196 MiB   4.77%   anon=117 MiB   file=74 MiB
13:45:15  cur=343 MiB   8.37%   anon=253 MiB   file=82 MiB
13:47:30  cur=463 MiB  11.30%   anon=371 MiB   file=84 MiB
13:47:33  cur=496 MiB  12.11%   anon=402 MiB
13:47:39  cur=757 MiB  18.49%   anon=638 MiB
13:47:42  cur=1469 MiB 35.86%   anon=1352 MiB
13:47:45  cur=2145 MiB 52.38%   anon=2026 MiB
13:47:48  cur=2875 MiB 70.19%   anon=2752 MiB
13:47:51  cur=3537 MiB 86.36%   anon=3413 MiB
13:47:54  cur=4096 MiB 99.99%   anon=4033 MiB   file=47 MiB  (peak = 4096 MiB = 100.00% of limit)
13:47:57  cur=3910 MiB 95.45%   anon=3888 MiB   file=2 MiB
13:48:00  container gone (exited normally)
```

Container limit (`docker compose config`): `mem_limit: 4294967296` (4 GiB),
memory+swap 8 GiB, cpus 1.5.

Host at the same time: 31.8 GB total, 3.4 GB used, **28.4 GB available**, swap
630 MB of 8 GB, `/proc/pressure/memory` `some avg10=0.00 full avg10=0.00`.
No kernel OOM messages in the current boot (`journalctl -k -b 0`), no
`OOMKilled`, no non-zero exit, no restarts on any long-lived container.

## 3. Classification

**Active, reproducible near-limit event inside the job container — not a
watchdog false positive, and not (yet) a failure.**

- The spike is real anonymous memory, not page cache: `anon` goes 371 MiB →
  4033 MiB while `file` collapses from 84 MiB to 2 MiB, i.e. the kernel
  reclaimed the container's entire page cache to keep the allocation under the
  4 GiB ceiling. The container touched **100.00% of its own limit** and survived
  only because that reclaim succeeded.
- The alerting value of 94.37% was a sample partway up that ramp. The watchdog is
  reporting correctly; the threshold is not the problem, so **no threshold was
  raised**.
- It is *reported* intermittently only because of sampling: the spike lasts
  ~25 seconds (13:47:33 → 13:47:57) and the watchdog ticks every 5 minutes, so it
  is caught roughly once or twice an hour. The 13:47:14 tick, twenty seconds
  before this very spike, reported `ok`. Absence of an alert is therefore not
  evidence that a scan stayed low.
- The spike is confined to the DB-write phase: `[perf] csv_writes`/`Saved scan
  snapshot` → `Wrote database rows`. On this run 13:47:33 → 13:47:59; the same
  ~22–25 s window appears on the 13:12 and 11:41 scans.

## 4. Impact

- **Scan outcome:** unaffected. 13:42 run wrote `scan_runs=1, scanner_signals=352`
  and exited 0 (`Finished market-alpha-fast-scan.service`); so did 13:12 and
  11:41. No scan has been lost to this.
- **Host:** unaffected. 28.4 GB available, memory pressure 0, swap flat. The 4 GiB
  ceiling is per-container; the host never approached its own limits.
- **Users:** no impact. No missing scan, no stale /terminal payload, no frontend
  or API degradation in the same window.
- **Headroom:** effectively zero. The job peaks at the limit itself. Any growth in
  universe size, history depth or per-row payload turns this into an OOM kill,
  which would lose that scan's writes rather than degrade them.

## 5. Where the memory goes (hypothesis, to be profiled)

The window matches `persist_scan_dataframe` in `database/writeback.py`. Two
candidates inside it materialize whole result sets before flushing:
`_dataframe_rows` (`df.to_dict(orient="records")` plus a per-cell
`to_database_jsonable` copy of a wide frame with nested object columns) and
`_persist_symbol_price_history` (per-symbol history frames, chunked at 1000 rows,
while the source frames are still referenced from the ranking frame's attrs).
This is a hypothesis from reading the code, not a measurement; the next step is a
`tracemalloc`/`memory_profiler` run of that phase on a copy of a real frame.

## 6. Follow-up

1. **Profile and reduce the DB-write phase** (owner action, needs deploy).
   Target: peak under ~2 GiB. Likely shape: stream rows instead of building the
   full `records` list, drop history frames from `attrs` before persisting, and
   flush price history in smaller chunks.
2. **Give the job margin** (host/compose change, outside the relay's allowlist —
   recommendation only): raise `mem_limit` for `market-alpha-scanner-job` from
   4 GiB to 6 GiB. The host has 28 GB available; this costs nothing and removes
   the OOM cliff while item 1 is done.
3. **Teach the watchdog about one-shot job containers.** For containers matching
   `*-run-*`, a momentary high `MemPerc` against their own limit is expected;
   what matters is `OOMKilled=true` or a non-zero exit. Suggested: keep a
   `warning` on the percentage, escalate to `critical` only on OOM/exit≠0, and
   add a distinct finding for "job exited non-zero".
4. **Log peak RSS per run** in the scanner itself (`resource.getrusage`
   `ru_maxrss` at the end of a run, next to `[perf] total_runtime`), so this is
   visible in the journal without external sampling.

Items 3 and 4 are cheap and safe; item 1 is the real fix; item 2 is the stopgap
and needs the operator, since compose/host edits are deliberately outside the
relay's allowlist.

## 7. Deploy needed to close this alert?

**No.** Nothing was changed on the box for this triage. The four read-only relay
actions added while investigating (`prod_resource_snapshot`,
`prod_docker_inspect_container`, `prod_watchdog_source`, `prod_scanner_job_watch`)
are relay-side only, committed and pulled to prod (`7d0e2535`), and do not enter
any image. No image rebuild, no service restart, no threshold edit.

The alert is understood and the system is not in danger today, so it does not
block other work; it does open follow-up items 1–4 above.
