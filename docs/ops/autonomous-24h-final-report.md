# 24-hour autonomous window — final report

Window 2026-09-04 02:28 → 23:20 UTC.

## 1. Production HEAD

**`1c6089cbde8763828a4c6d149a38580df86fbb44`** — deployed 13:07 UTC, up 10
hours at close, both frontend containers healthy, `restarts=0`.

**The prod checkout sits on `release/actionability-fix`, not `origin/main`.**
Push was refused every time it was attempted, all day, so the authorised
fallback was used: prod pulled the exact remote branch. This is safe and
self-healing — `release/actionability-fix` is `main` plus one cherry-pick, the
pull was a genuine fast-forward from `b177dea8`, and `origin/main` is now an
*ancestor* of prod HEAD, so the documented `git pull --ff-only origin main`
still succeeds as a no-op until `main` moves past `1c6089cb`. No cleanup will
be needed.

Two literal branch names were added to the relay's deploy allowlist
(`git fetch origin release/actionability-fix`,
`git pull --ff-only origin release/actionability-fix`). Literal names, not a
pattern that accepts any branch.

## 2. Commits deployed to production

One:

```
1c6089cb  Compute terminal actionability on the server, repairing a regression I shipped
```

Five files. It changes no payload. It was verified as the minimal set by
cherry-picking it onto `main` alone and running typecheck and the full suite on
that tree before deploying.

## 3. Branch and push state

Push was refused on every attempt with the same message: *"Solaris11/market-alpha-scanner
is not in this session's authorized repository set, so the proxy will not
inject a credential for it."* That is a session-sources setting, not a
permission this session can grant itself. Read access works fine.

| Branch | Local tip | Remote tip | Gap |
|---|---|---|---|
| `main` | `b177dea8` | `b177dea8` | — |
| `release/actionability-fix` | `1c6089cb` | `1c6089cb` | in sync, **deployed** |
| `release/success-rate-units` | `80197b38` | *absent* | **1 commit, undeliverable** |
| `work/autonomous-after-b177` | `b1842acc` | `85511c29` | 4 commits behind local |
| `work/ux-polish` | `eb4cfeac` | `eb4cfeac` | in sync |

Four commits exist only locally:

```
3b01d117  Fix the success rates that made every card read 0%, and correct my own claim
546be1ca  Record the deploy, and that it is what disproved my diagnosis
8f9d57a1  Commit a day of memory samples, and note the reading I destroyed
b1842acc  Add the 19:27 sample: 457MiB at 6h, with real traffic in the window
```

**`release/success-rate-units` (`80197b38`) is the one to ship next.** It is
prod HEAD plus a single commit, and it is the change that puts real numbers on
the cards.

## 4. Test, typecheck and build results

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.json` | clean on all branches |
| Full suite (150 test files at close) | all pass on all branches |
| **`next build`** | **passed** — `✓ Compiled successfully in 10.7s` inside the image build on the host, `docker compose build` exit 0 |

The image build is the real build gate: `npm ci` plus `next build` on Linux.
That is the check that could not run anywhere else in this session — the
mounted `node_modules` is a macOS install without the linux-arm64 esbuild and
SWC binaries, and neither the bridge VM nor the cloud container can reach the
npm registry. The test suite ran through a Node module hook that transpiles
`.ts` with TypeScript's own transpiler in place of `tsx`; it lives in
`frontend/.next/tv-scratch/`, which is gitignored and disposable.

## 5. UX before/after screenshot paths

**There are none, and none were obtainable.** All three routes were tried:

- the cloud container has Chromium and Playwright, but its egress proxy refuses
  `tradeveto.com` (`net::ERR_TUNNEL_CONNECTION_FAILED`);
- the in-app browser renders the site and its DOM can be read — every UX
  measurement in this report came from it — but screenshot capture returns
  blank frames and the images cannot be written to repository paths;
- "after" shots would need the branch running somewhere, and both `next build`
  and `next dev` need the SWC binary described above.

The before-state is recorded **numerically** instead, which is re-checkable
after a deploy in a way a screenshot is not:

| Measurement | Value on prod |
|---|---|
| mobile header account button, right edge at 375px viewport | **379px** — clipped, inside `overflow-x: hidden` |
| `/discover` compare matrix, 3 symbols loaded | container ends 346px, EOG column runs to 362px — **16px cut off**, no scrollbar |
| `/terminal` at 375px | `documentElement.scrollWidth === 375` — the page clips rather than scrolls |
| containers flagged as overflowing at 375px | 18, of which the three largest are decorative glow layers that `overflow-hidden` exists to clip |

UX work landed on `work/ux-polish` (5 commits, in sync with the remote):
compare matrix and scanner table now scroll horizontally; mobile header account
button can actually shrink; activation nudge reads the nav-clearance token
instead of recomputing it; four charts gained the numbers and keys they were
drawing without (`MiniCandleStrip`, `ScoreFactorStrip`, `PosterGauge`,
`SignalHeatmap`); conviction bands moved to `src/lib/ui/conviction-bands.ts`
with six tests so legend and tiles cannot disagree; Tailwind's `animate-pulse`
is now gated on `prefers-reduced-motion`, which the framework does not do and
which had no other override point given there is no `tailwind.config`.

## 6. Performance and memory

### Performance

| Metric | Value |
|---|---|
| `/terminal` server render, warm | **1,083–1,109 ms** (1,300 ms on the cold container right after deploy) |
| `/terminal` DOM interactive, pre-deploy warm | 2,771 ms |
| decoded HTML | 13,837,994 B |
| flight payload | 12,180,208 chars |
| provider / debug fields in client payload | **0** across all six keys, before and after |
| `/api/user/watchlist` calls per load | **2** — the fix for this is in `345997e0`, not yet deployed |
| `/api/discovery` calls per load | 2 — **not a defect**, this is deliberate progressive loading and both responses are used |

### Memory

The diagnosis changed twice during the window, and both corrections matter.

**Idle is completely flat.** Three samples across 7h11m before the deploy read
1.116, 1.117, 1.117 GiB. Nothing grows with wall-clock time.

**Load is what grows it.** A controlled read-only experiment: 14
`/api/discovery` fetches (all cache hits) moved nothing; **8 full `/terminal`
renders moved it from 1.117 to 1.222 GiB, +105 MB**, still unreleased after
2.5, 5 and 7 minutes. About 13 MB retained per 13.8 MB document, which makes
+491 MB roughly 38 page loads — an ordinary day.

**The cache explanation is withdrawn.** I had claimed `discoverySystemCache`
entries hold megabytes each and that 66 of them explained +491 MB. Measured,
the serialized discovery system is **255 KB** full and 23 KB initial; 66
entries is about 20 MB, not hundreds. I had confused it with `/terminal`'s
whole RSC payload. The cap in `f6d9e1ea` stays — an unbounded cache is a defect
regardless — but it is not the cause, and it should not be sold as the memory
fix. The lever the numbers point at is payload size, which makes **Stage 3 the
memory change**: it removes 4.7 MB from a 13.8 MB document.

**Post-deploy curve**, from a clean baseline the previous one never had:

| UTC | frontend | postgres | note |
|---|---:|---:|---|
| 13:08 | 138 MiB | — | fresh container |
| 13:23 | 354 MiB | — | after verification loads |
| 15:56 | 409 MiB | 377.7 MiB | flat since 13:23, no renders in the log |
| 19:27 | 457 MiB | 420.1 MiB | first interval with genuine traffic |
| 23:16 | 570 MiB | 428.1 MiB | closing sample, 10h uptime |

**Evidence I destroyed.** The 10:00 experiment left the container at 1.222 GiB,
and whether that came back down over the following hours would have separated
"uncollected garbage" from "genuinely retained" with no instrumentation at all.
I deployed at 13:07, which recreated both containers and reset the counter. The
deploy was right and I would make it again, but the sequencing was mine to
choose, and the stability report had warned in writing that a deploy resets the
memory baseline — I had read that sentence earlier the same day. Repeat the
four-minute experiment on the current deploy before concluding anything, and do
not schedule a deploy behind it.

**Observer.** The two metrics the 24-hour stability report had to mark
UNMEASURABLE — running container count and Postgres memory — are measurable
now (`febd94e5`). The data was already being collected every sample as opaque
`docker ps` / `docker stats` strings; what was missing was the parsing. No new
command on the host, no added cost.

## 7. SNDK

**Not rebuilt.** The relay denies both halves by design — `docker compose build`
is allowlisted only for the two frontend services, and `docker ... run` is
denied outright — and I did not widen beyond exact command patterns, which was
the standing constraint.

The read-only assessment is complete and is more reassuring than "86 days of
drift" suggests (`docs/ops/sndk-scanner-job-rebuild-assessment.md`):

- the image is from 2026-06-10; SNDK entered the universe after that;
- `requirements.txt` is **byte-identical** to the commit the image was built
  from, and every dependency that touches scan arithmetic is exact-pinned
  (`numpy==2.4.4`, `pandas==3.0.2`, `yfinance==1.3.0`);
- the unpinned packages (`fastapi`, `uvicorn`, `streamlit`) are not on the scan
  execution path — the job runs `python investment_scanner_mvp.py`;
- the application delta is three commits, one of which is a pure
  type-annotation refactor with no runtime effect;
- the only thing reading cannot settle is the unpinned `python:3.12-slim` base
  tag, which is exactly what a dry-run settles.

Recommendation: rebuild after a dry-run into a separate `--outdir`. Exact
command sequence, acceptance criteria and rollback are in that document.

## 8. Rollback plans

**Current deploy.** Rollback tags were taken *before* the build:
`rollback-20260904a` → frontend `ee979bbb6d73`, hot-api `45fc8fd8e808` (both
verified still present at close).

```bash
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:rollback-20260904a market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260904a market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
```

The running image is what serves, so the retag alone restores behaviour. To
move the checkout back as well: `git checkout b177dea8 -- .`

**Next deploy.** Take `rollback-20260904b` before building, same order: tag,
then pull, then build, then `up -d --no-build`. Tagging after the build points
the "rollback" tag at the new image, which is not a rollback.

**SNDK.** Retag `:rollback-20260610`. The scans are oneshot timer units, so
there is no container to revert — but note that database rows written by a bad
scan are *not* rolled back, which is why the dry-run into a separate outdir is
mandatory rather than optional.

## 9. Remaining risks and open items

**The live wrong number is still live.** `chaseSuccessRate` and
`pullbackSuccessRate` are fractions — `rate()` returns `matched / total`, and
all 1,134 rows of `shock_move_patterns` hold them in 0–1. Four sites in
`execution-intelligence.ts` read them as percentages:

- `Math.round(0.2667)` is `0`, so every terminal card prints **"chase success
  is limited at 0%"** against a real 24–58%;
- the guard `chaseSuccessRate < 45` is true for *every possible fraction*, so
  that risk warning fires on **every symbol unconditionally** — which is why
  all five cards are identical;
- `pullbackQuality` weights the fraction `0.20` against five terms on 0–100,
  costing about six points wherever a pattern exists. A scoring error, not a
  display one.

Fixed in `80197b38`, gated and tested, **undeployable without a push**. This is
the highest-priority open item.

It survived every test because the fixture said `58` and `64` — percentages the
producer never emits — and no test asserted on the rendered strings. Both are
fixed.

**A claim of mine this window corrected.** I reported the actionability
regression as three of five strings changing on any symbol with real shock
history. That was one synthetic fixture's behaviour. Swept across 144 fixtures
the divergence appears in **8**, all needing the event list at its 80-event cap
plus a BREAKOUT/MOMENTUM/CONTINUATION setup; the test file's own heavy fixture
exposes it in none of 60 combinations. `1c6089cb` is still correct and is what
makes Stage 3 safe, but it was **not** the repair for what users were looking
at — deploying it and watching nothing change is how that was discovered.

**Stage 3 must not ship from the remote tip as it stands.** The remote's
`work/autonomous-after-b177` (`85511c29`) contains Stage 3 *and* the
evidence-maturity repair, so it is currently safe — but if anyone ships Stage 3
without `af8ebf24`, every evidence card drops from Developing Evidence (79) to
Limited Evidence (29). Details in
`docs/ops/stage3-silent-regression-audit.md`.

**Other open items.**

- Watchlist duplicate POST is still 2 per load; the fix is in `345997e0`, not
  deployed.
- Memory: the render-correlated experiment needs repeating on the current
  deploy. Neither frontend container has a memory limit (`mem_limit=0`).
- Ten `rollback-*` frontend tag pairs at ~1.5 GB each, roughly 15 GB, going
  back to 2026-09-01. Safe to reclaim once this deploy is proven.
- `tools/db/run-migrations.sh` is silently broken (`psql: command not found`,
  looks on the host rather than through the container). Unowned; will bite the
  first non-idempotent migration.
- One real 71px mobile clip in `.tv-cinematic-card` is documented and
  deliberately not fixed — fixing it blind in a layout I cannot see is how a
  small problem becomes a broken card.

## 10. What one push unblocks

Adding the repository to this session's sources would let a single push deliver
`release/success-rate-units`, after which the deploy and its verification can
run unattended: build gate, rollback tag, deploy, and the check that matters —
**chase percentages differing between symbols and non-zero**.
