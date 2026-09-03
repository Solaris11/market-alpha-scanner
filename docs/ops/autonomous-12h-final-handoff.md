# 12-hour autonomous window: final handoff

Written 2026-09-03 21:10 UTC, on branch `work/autonomous-after-b177`.

## The one thing to read first

**Production is still running `b177dea8`, and the terminal actionability
regression is still live.** The fix exists and is tested, in commit `98afc6c6`
on `work/autonomous-after-b177`. It cannot reach production from this session:
every push path is refused (see Blockers). Production deploys with
`git pull --ff-only origin main`, so the fix reaches users only after you run
the push yourself.

The regression, restated so the decision is yours to make on the facts: Stage 1
strips `ShockMoveEvent.preconditions` from the terminal payload, but two client
components recompute actionability from the rows they receive. With the
preconditions gone they compute a different answer than the server would. On an
80-shock fixture, three of the five rendered strings change. I shipped that in
the Stage 1 deploy; `98afc6c6` computes the five strings on the server and
passes them down, and `terminal-actionability.test.ts` asserts the server card
is byte-identical to what the client used to produce.

## What was done, by the priority order you set

**1. Actionability regression.** Fixed and tested, not deployed. `98afc6c6`
adds `terminal-actionability.ts` (server-computed cards, one per row, covering
every row rather than the visible subset because both radars choose their
symbols client-side) and nine tests. `857af454` then drops the 4.7 MB
`shockEvents` array from the payload, which is only safe once the cards travel.

**2. Provider leakage and Stage 3.** Leaks are at 0. Stage 3 (`857af454`) is
committed behind the same push blocker.

**3. forwardQuery performance.** `4017e0e6` applies the `forward_returns` index
and records the measurement.

**4. SNDK scanner-job.** Root-caused to a 2026-06-10 scanner-job image. The
runbook is written (`39c14e6f`, `docs/ops/pending-prod-approvals.md`); the
rebuild itself still needs your approval and was not performed.

**5. Watchlist duplicate POST.** Root-caused and fixed in `345997e0`.
`useLocalWatchlist` is a hook, so every consumer runs its own mount effect, and
several mount on /terminal. The in-flight guard added earlier collapses syncs
that overlap *and* carry the same body; the remaining pair does neither,
because the first sync writes the merged list back to storage and the later
mount then builds a different body. The coordinator now remembers which account
it reconciled in this page session. It moved to
`src/lib/client/watchlist-sync.ts` with an injectable fetcher so it can be
tested; five tests cover the sequential case, account switching, and that a
failed sync is not remembered.

One thing worth flagging in that fix: the short circuit returns `null` rather
than an empty payload, because the hook writes storage from the payload and an
empty one would have cleared the reader's watchlist. That would have been a
much worse bug than the duplicate request, and it is the reason the null
contract has its own test.

## A regression I caused and only found today

`61366d3b` made `ShockMovePattern.shockEvents` optional so the payload could
drop it. That broke `scripts/shock-pattern-refresh.ts` — the script that
*writes* the patterns — in three places, and I did not catch it at the time.
`tsc --noEmit -p tsconfig.json` reported all three today; they are fixed in
`345997e0`. The sample size now reads `shockEventCount`, which is the field
that carries it.

I do not know why this was not caught then. The most likely explanation is that
the typecheck I ran did not cover `scripts/`, or did not run at all on that
commit. Treat the earlier "typecheck green" claims on this branch as covering
`src/` only.

## Blockers

**Push is impossible from both environments.** Bridge VM SSH returns
`Forbidden`; bridge HTTPS returns `403 from proxy`; the cloud container reports
the repository is `not in this session's authorized repository set`. Nothing in
this window changed that. Eight commits on `work/autonomous-after-b177` and two
on `work/ux-polish` are local only.

**`npm test` and `next build` cannot run on the bridge VM.** The mounted
`node_modules` was installed on macOS: `@esbuild/darwin-arm64` and
`@next/swc-darwin-arm64` are present, the linux-arm64 packages are not, and the
VM has no npm egress (403) — nor does the cloud container (403 on the registry
generally). So `tsx`, and therefore `npm test`, and `next build`, all fail here
for platform reasons rather than code reasons.

I worked around the test half rather than reporting it as untestable. TypeScript
itself is pure JS and already installed, so a Node module hook that transpiles
`.ts` with `ts.transpileModule` does what `tsx` did. It lives in
`frontend/.next/tv-scratch/` — gitignored, outside the repo's tracked tree, and
disposable. **All 142 test files pass** under it on both branches, and
`tsc --noEmit` is clean on both.

`next build` has no equivalent workaround: it needs the native SWC binary. **The
build gate has not been run.** You must run `npm run build` on your Mac before
deploying anything from either branch. `tsc` and the full test suite passing is
what I can offer in its place, and it does not cover RSC boundary errors.

## What is still open

- **Frontend memory.** Failed its threshold in the 24h observation: +491 MB
  against a +50 MiB budget. Needs a 48–72h follow-up window. Not investigated
  in this window.
- **SNDK scanner-job rebuild.** Runbook ready, awaiting your approval.
- **Deploy of both branches.** Blocked on push and on the build gate.

## What I need from you, in order

1. `cd /Users/hdtv/dev/market-alpha-scanner && npm --prefix frontend run build`
   on `work/autonomous-after-b177`, then on `work/ux-polish`. If either fails,
   nothing below should proceed.
2. Decide whether the actionability fix goes to `main` on its own or with the
   rest of the branch. It is priority 1 and it is a live user-facing wrong
   value; the rest of the branch is performance work that can wait.
3. `git push` whichever branches you want on the remote.
4. Approve or decline the SNDK scanner-job rebuild.

## Constraints observed

No production deploy, no container restart, no DB write, no scanner-job
rebuild, no `CREATE INDEX` beyond the one already approved and applied in
`4017e0e6`, no changes to the root `package.json` (still untracked and
untouched), and no secret, token, password or env value written or logged.
Real user data was not touched. Nothing was merged or pushed to `main`.
