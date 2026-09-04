# Deploy runbook: closing the live actionability regression

Written 2026-09-04. Everything below is verified except the build gate, which
cannot run in this session. Read "Why you have to run this" first if you want
the reason it is a runbook and not a completed deploy.

## READ THIS FIRST: do not merge `work/autonomous-after-b177` as it stands on the remote

You pushed both branches after the last session. Verified against the remote
today:

```
b177dea8  refs/heads/main
9d6013a0  refs/heads/work/autonomous-after-b177
ffcd29b2  refs/heads/work/ux-polish
```

So the actionability fix is already on GitHub. Only `main` needs to move.

**But the remote's copy of `work/autonomous-after-b177` contains Stage 3
(`857af454`) without the fix for what Stage 3 breaks.** I found that tonight:
Stage 3 removes `shockEvents`, and `evidence-maturity.ts` derives three
rendered values by walking that array from three client components on
`/terminal`. Stage 3 guarded them with `?? []`, which stops a crash and
preserves nothing:

| Rendered field | With array | After Stage 3 as pushed |
|---|---:|---:|
| `evidenceSampleSize` | 26 | 13 |
| `historicalDepthDays` | 163 | 0 |
| `outcomeCoverage` | 100% | 0% |
| `score` | 79 | 29 |
| `label` | Developing Evidence | **Limited Evidence** |

The repair is `af8ebf24`, which is **local only** — I still cannot push.

So: **merging the remote branch into `main` right now would trade one silent
regression for another.** The safe move is `release/actionability-fix`, which
is `main` plus the single actionability commit and nothing else. Full detail in
`docs/ops/stage3-silent-regression-audit.md`.

`work/ux-polish` on the remote is complete and carries no such hazard.

## Why you have to run this

`main` cannot be advanced from this session. Three paths, all tested today:

| Path | Result |
|---|---|
| Cloud container over HTTPS | clone and fetch work; push refused — *"Solaris11/market-alpha-scanner is not in this session's authorized repository set, so the proxy will not inject a credential for it"* |
| Bridge VM | SSH `Forbidden` at the proxy; HTTPS `403 from proxy` |
| Your Mac via computer control | Terminal resolves at `click` tier only — I can see and click, but not type, so no shell |

The ops relay reaches production and is healthy, but it runs commands *on
production* and its validator denies `git push` by design. So production can
pull, but nothing can make there be something to pull.

The build gate has the same shape: the `node_modules` mounted from your Mac is
a macOS install (`@esbuild/darwin-arm64`, `@next/swc-darwin-arm64`), the
linux-arm64 packages are absent, and neither environment can reach the npm
registry (403). `next build` needs the native SWC binary and there is no
workaround for that.

## What I could verify

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.json` | clean, on `release/actionability-fix`, `work/autonomous-after-b177` and `work/ux-polish` |
| Full test suite, 142 files | all pass on all three branches |
| Cherry-pick of the fix onto `main` | clean, no conflicts |
| `next build` | **not run — this is your gate** |

The test suite ran through a Node module hook that transpiles `.ts` with
TypeScript's own transpiler, because `tsx` cannot start here (esbuild has no
linux binary in the mounted tree). It lives in `frontend/.next/tv-scratch/`,
which is gitignored and disposable. `npm test` on your Mac is the real thing
and should agree.

## The minimal change set, and why it is minimal

**`release/actionability-fix` is `main` plus exactly one commit.**

That branch exists locally and is ready. The commit is `98afc6c6`
(`1c6089cb` after the cherry-pick), *Compute terminal actionability on the
server*. Five files:

```
frontend/src/components/opportunities/RiskTolerantOpportunityRadar.tsx
frontend/src/components/opportunities/ShockMoveRadar.tsx
frontend/src/components/terminal/TerminalPremiumView.tsx
frontend/src/lib/trading/terminal-actionability.ts       (new)
frontend/src/lib/trading/terminal-actionability.test.ts  (new)
```

It does **not** need the other seven commits on `work/autonomous-after-b177`.
I checked rather than assumed: cherry-picked it onto `main` alone, then ran
typecheck and the whole suite on that tree. Clean.

It also changes no payload. Stage 3 (`857af454`), which drops the 4.7 MB
`shockEvents` array, is a separate commit and depends on this one — it is not
in this branch. Ship the repair first, measure, then decide about the payload.

## What is broken right now, so you can confirm the fix worked

Measured on production `b177dea8` at 02:40 UTC today, signed in as
`perf-test@tradeveto.com`. Full capture in
`docs/ops/prod-baseline-b177dea8-20260904.md`.

Every shock card on `/terminal` currently renders the same three lines:

```
Watch only: Early; needs confirmation
This needs more confirmation before it becomes clean. Look for relative-volume
confirmation rather than isolated price movement.
Breaks if: ... Historical chase success is limited at 0% in comparable shock samples.
```

Five cards, one distinct value for the action line, one for the context, and
**0% chase success for every symbol**. Only the invalidation price varies,
because that comes from the row rather than from the shock calibration.

The cause, from the two pages' own flight payloads — same component, same data,
one page stripped and one not:

```
/opportunities   "outcomeStatus":"complete","preconditions":{"atrPercent":2.461, ...}
/terminal        "outcomeStatus":"complete","return1d":3.855, ...
```

12,882 `preconditions` occurrences on `/opportunities`; 532 on `/terminal`, of
which 355 are `commonPreconditions`, a summary field. The per-event
preconditions the calibration reads are gone, so it degrades every symbol to
the same answer.

**After the deploy, chase success should differ between symbols and the action
line should stop being one string repeated five times.** That is the check.

## Sequence

### 1. Build gate, on the Mac

```bash
cd /Users/hdtv/dev/market-alpha-scanner
git switch release/actionability-fix
npm --prefix frontend ci          # only if node_modules is stale
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run lint
```

**If the build fails, stop.** Nothing below should run.

### 2. Push

`release/actionability-fix` is local, so it has to go up with `main`. The
commit it carries is a cherry-pick of `98afc6c6`, which is already on the
remote inside the other branch — same change, different hash.

```bash
git switch main
git merge --ff-only release/actionability-fix
git push origin main
```

### 3. Deploy

Every line below is already on the relay's deploy allowlist, so you can either
run them yourself over SSH or drop them into `.tvops/queue/NNNN.cmd` and let the
relay do it. Use one timestamp throughout; `20260904a` below.

```bash
cd /opt/apps/market-alpha-scanner/app
git fetch origin main
git pull --ff-only origin main

docker tag market-alpha-scanner-market-alpha-frontend:latest market-alpha-scanner-market-alpha-frontend:rollback-20260904a
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:latest market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260904a

docker compose --env-file .env build market-alpha-frontend market-alpha-frontend-hot-api
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
```

Tag **before** building. The build overwrites `:latest`, and a rollback tag
taken afterwards points at the new image, which is not a rollback.

As a relay file, with the longer ceiling the image build needs:

```
# timeout: 1500
git fetch origin main
git pull --ff-only origin main
docker tag market-alpha-scanner-market-alpha-frontend:latest market-alpha-scanner-market-alpha-frontend:rollback-20260904a
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:latest market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260904a
docker compose --env-file .env build market-alpha-frontend market-alpha-frontend-hot-api
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
```

### 4. Verify on the host

```
# timeout: 200
git rev-parse --short HEAD
docker compose ps
docker inspect market-alpha-frontend --format "restarts={{.RestartCount}} health={{.State.Health.Status}}"
docker inspect market-alpha-frontend-hot-api --format "restarts={{.RestartCount}} health={{.State.Health.Status}}"
docker compose logs --tail 80 market-alpha-frontend
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}" market-alpha-frontend market-alpha-frontend-hot-api
```

Expect `HEAD` at the new commit, both containers healthy, `restarts=0`, and no
new stack traces in the log tail.

### 5. Verify in the browser

Sign in as `perf-test@tradeveto.com`, open `/terminal`, and run this in the
console. It is the same script that produced the baseline.

```js
const first = [], ctx = [], chase = [];
for (const el of document.querySelectorAll('span.font-semibold.text-slate-200')) {
  if ((el.textContent || '').trim() !== 'Breaks if:') continue;
  const card = el.parentElement?.parentElement; if (!card) continue;
  const L = [...card.children].map(c => (c.textContent || '').replace(/\s+/g, ' ').trim());
  first.push(L[0]); ctx.push(L[1]);
  const m = (L[2] || '').match(/limited at ([\d.]+)% in comparable/); if (m) chase.push(m[1]);
}
const tally = a => Object.entries(a.reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {}));
let flight = '';
for (const s of document.scripts) if ((s.textContent || '').includes('self.__next_f.push')) flight += s.textContent;
const api = performance.getEntriesByType('resource').filter(r => r.name.includes('/api/'));
const calls = {}; for (const r of api) { const u = new URL(r.name).pathname; calls[u] = (calls[u] || 0) + 1; }
console.log({
  distinctActionLines: tally(first),
  distinctChasePct: tally(chase),
  watchlistCalls: calls['/api/user/watchlist'],
  providerLeaks: ['alpaca_request_id','polygon_request_id','provider_debug','_debug']
    .map(k => [k, (flight.match(new RegExp(k, 'g')) || []).length]),
  domInteractive: Math.round(performance.getEntriesByType('navigation')[0].domInteractive),
  htmlBytes: performance.getEntriesByType('navigation')[0].decodedBodySize,
});
```

| Check | Before | Pass condition |
|---|---|---|
| distinct action lines | 1 | **more than 1** |
| distinct chase percentages | 1 (`0`) | **more than 1**, and not all zero |
| provider leaks | all 0 | still all 0 |
| DOM interactive | 2,771 ms | no worse than ~3,000 ms |
| decoded HTML | 13,837,994 B | unchanged — this commit does not touch the payload |
| console errors | none | none |
| network 4xx/5xx | none | none |

`watchlistCalls` stays at **2** with this commit alone; the fix for that is
`345997e0`, which is not in `release/actionability-fix`.

### 6. Rollback

If any check fails:

```bash
cd /opt/apps/market-alpha-scanner/app
docker tag market-alpha-scanner-market-alpha-frontend:rollback-20260904a market-alpha-scanner-market-alpha-frontend:latest
docker tag market-alpha-scanner-market-alpha-frontend-hot-api:rollback-20260904a market-alpha-scanner-market-alpha-frontend-hot-api:latest
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
docker compose ps
```

The git checkout can stay forward; the running image is what serves. Revert the
commit on `main` separately if you want the checkout to match.

## After that lands

In this order, each with its own build gate and its own verification pass:

1. **`work/autonomous-after-b177`, local tip, not the remote's** — the
   remaining commits: Stage 3 payload reduction, the watchlist duplicate fix,
   the evidence-maturity repair, the memory cache bound and the health
   instrumentation.

   **Push the local tip first.** The remote is six commits behind and stops at
   `9d6013a0`, which includes Stage 3 but not `af8ebf24`. Deploying the remote
   tip ships the evidence downgrade in the table above.

   ```bash
   git switch work/autonomous-after-b177
   npm --prefix frontend run build     # gate
   git push origin work/autonomous-after-b177
   ```

   Then verify `htmlBytes` drops by roughly 4.8 MB, the action lines *stay*
   varied, and the evidence cards still read Developing Evidence rather than a
   page of Limited Evidence.
2. **`work/ux-polish`** — three commits, no business logic. Its own report is
   `docs/ux/ux-polish-2026-09-03.md`, including the one change I could not
   measure.
3. **SNDK scanner-job rebuild** — `docs/ops/sndk-scanner-job-rebuild-assessment.md`.
   Dry-run first; the acceptance criteria are in that file.
