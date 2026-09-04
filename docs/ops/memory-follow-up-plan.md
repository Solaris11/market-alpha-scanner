# Frontend memory: what I found, and the 48–72h plan

Written 2026-09-04. The 24-hour stability observation recorded the frontend
container growing **+491 MB against a +50 MiB budget**. This is the follow-up.

## What I measured, and where it contradicts what I wrote first

I wrote the first version of this document from reading the code. Then I
measured, and the measurement moved the answer. Both halves are below, because
the correction is the useful part.

### Idle is completely flat

Three samples across 7h11m on prod `b177dea8`, container up 15h, `restarts=0`:

| UTC | frontend |
|---|---:|
| 02:49:12 | 1.116 GiB |
| 06:28:25 | 1.117 GiB |
| 10:00:13 | 1.117 GiB |

Nothing grows with wall-clock time. Whatever produced +491 MB needs traffic.

### The controlled experiment

Read-only, one already-authenticated test account, on production.

**14 `/api/discovery` fetches** (both packet modes, 7 each). Every one a cache
hit at 57–71 ms and identical byte counts. Memory afterwards: **1.117 GiB, no
change.** So the discovery cache path costs nothing when it hits.

**8 full `/terminal` renders**, 106 MB of HTML, ~2.9 s each. Memory afterwards:
**1.222 GiB — plus 105 MB.** Roughly 13 MB retained per render, against a
13.8 MB document. Still 1.222 GiB after 2.5, 5 and 7 minutes idle. Not
released.

**8 more renders**, watching `/api/health` rather than the container:

| | heapUsed | rss |
|---|---:|---:|
| before | 740.9 MB | 1264.9 MB |
| +4 s after | 812.5 MB | 1276.7 MB |
| +5 min idle | **890.5 MB** | 1277.5 MB |

rss barely moved the second time because the arena was already grown. heapUsed
rose 71.6 MB during the batch and a further 78 MB while idle afterwards — which
is consistent with the discovery background refresh firing when the 10-minute
TTL expired on the entries the load had just touched.

### Evidence I destroyed, and should not have

The 10:00 experiment left the container at 1.222 GiB with heapUsed around
890 MB, and the open question was whether that would come back down on its own
over the following hours. If it had, the retained bytes were garbage awaiting
collection; if it had not, they were genuinely held. That single reading would
have separated the two explanations without any instrumentation at all.

**I deployed at 13:07 and recreated both containers, which reset the counter.**
The question is now unanswerable for that window. It was a reasonable deploy
and I would make it again -- the actionability fix mattered more than the
observation -- but the sequencing was mine to choose and I did not think about
the cost until afterwards. The stability report had even warned that a deploy
resets the memory baseline; I had read that sentence and still walked into it.

The post-deploy curve is a clean substitute in one respect and not in another:
it starts from a known 138 MiB, which the earlier curve never had, but it has
not yet been through a controlled load. Repeat the four-minute experiment on
the current deploy before drawing conclusions, and this time do not schedule a
deploy behind it.

### What this establishes, and what it does not

**Established.** Growth is proportional to request volume, not to time. About
13 MB is retained per `/terminal` render and is not returned over the following
seven minutes. At that rate, +491 MB is roughly 38 page loads — which is an
entirely ordinary day for this site.

**Not established.** Whether those bytes are live or garbage that has not been
collected. Separating them needs a forced major GC, which needs `--expose-gc`,
which is a deploy. `heapUsed` climbing *during idle* is suggestive of the
background refresh allocating rather than of a pure leak, but that is a
plausible reading, not a demonstrated one.

### The claim I am withdrawing

The first version of this document said `discoverySystemCache` entries hold
"megabytes of string" and that 66 of them was the right order of magnitude for
+491 MB. **That was wrong, and I inferred it rather than measuring it.** The
serialized discovery system measures **255 KB** for the full packet and 23 KB
for the initial one — I read those off the responses. Sixty-six entries is
therefore on the order of 20 MB, not hundreds. I had confused the size of the
discovery system with the size of `/terminal`'s whole RSC payload, which is a
different and much larger object.

The cache is still unbounded and still worth capping — an unbounded cache is a
defect whatever its current size — but **it is not the explanation for
+491 MB**, and `f6d9e1ea` should not be sold as the memory fix.

### What this points at instead

The cost scales with the size of the document being rendered. `/terminal`
produces 13.8 MB per response and retains about 13 MB of it.

That makes **Stage 3 the memory lever**, which nobody had connected to memory:
it removes 4.7 MB of `shockEvents` from a 13.8 MB document, a 34% reduction in
the thing that correlates with the cost. If the per-render retention is
proportional to payload size, Stage 3 should cut it by about a third. That is a
prediction, and the experiment above is repeatable, so it is testable rather
than hopeful — **re-run exactly this experiment after Stage 3 deploys.**

## The instrumentation that will settle it

`/api/health` previously reported `rss` and `heapUsed`, which say the process
is bigger without saying what holds the bytes. It now also carries:

| Field | What it answers |
|---|---|
| `heapTotalMb` | `heapTotal − heapUsed` is the fragmentation signal. A process building multi-megabyte strings holds arenas it cannot return to the OS: rss climbs while heapUsed stays flat. That is a different problem from a retained object graph. |
| `externalMb` | Bytes outside the V8 heap — where large strings and buffers land. |
| `caches` | Live entry count per registered cache (`discoverySystem`, `symbolDetail`). If rss climbs while these stay flat, the caches are not the cause and this whole hypothesis is wrong. |

That last one is the point. It is the cheapest possible way to falsify my own
explanation, and it costs a `Map.size` read on a health poll.

## The 48–72h observation

**Precondition:** `work/autonomous-after-b177` must be deployed, otherwise
`/api/health` does not carry the new fields and the window measures nothing new.

0. **Re-run the controlled experiment.** Baseline, 8 `/terminal` renders,
   measure, wait 7 minutes, measure again. Compare the per-render retention
   against the ~13 MB measured on `b177dea8`. This is the single most
   informative reading in the whole plan and it takes four minutes.
1. **Baseline at t=0.** Record `rss`, `heapTotal`, `heapUsed`, `external`, and
   each cache count immediately after the container starts. The container
   healthcheck already polls `/api/health` every 30s and the stability observer
   every 60s, so no new load is added.
2. **Sample every 15 minutes for 72 hours.** The existing stability observer
   pattern is the right vehicle; it already writes JSON lines and it already
   has a supervised transient-unit form on the relay's allowlist.
3. **Read it as three questions, in order:**
   - Does `discoverySystem` sit at its cap of 24? Given the measurement above
     this is now the *least* likely explanation; the counter is there to close
     it out rather than to confirm it.
   - Does `rss` still climb while cache counts are flat? Then it is outside the
     caches, and the next suspect is fragmentation from large-string churn.
   - Does `heapTotal − heapUsed` widen while `heapUsed` stays flat? That is
     fragmentation, and the fix is to stop building the strings, not to evict
     more.
4. **Acceptance:** rss growth over the window under +50 MiB with cache counts
   at or below their caps. If rss growth is bounded but above +50 MiB while
   cache counts are pinned at the cap, the budget is wrong rather than the code
   — say so and change the budget deliberately.

## Heap snapshots: the risk, and why I am not proposing one on production

A V8 heap snapshot of this process **would contain real user data and
secrets**. Concretely: `sessionUserCache` holds `AuthUser` objects with email
addresses, `entitlementCache` holds plan and billing state, `watchlistCache`
holds per-user symbol lists, and `process.env` — database URL with its
password, Stripe keys, mail credentials — is reachable in the snapshot graph.
A `.heapsnapshot` is a JSON file with all of it in plain text.

So the rule is: **no heap snapshot on production, and if one is ever taken it
never leaves the host and is deleted in the same session.** No copying it to a
laptop, no attaching it to an issue, no putting it anywhere this session or any
other can read it.

Taking one also costs a full stop-the-world pause proportional to heap size —
on a 1.1 GB heap, seconds — during which the container fails its healthcheck
and may be restarted, destroying the very state being measured.

The alternative that carries none of this: reproduce locally. Point a
development build at a copy of the schema with synthetic accounts, drive N
distinct user ids through `/discover`, and watch `discoverySystem` and `rss`
together. If 60 synthetic users reproduce a multi-hundred-megabyte climb before
`f6d9e1ea` and not after, that is the causal proof, obtained without touching a
real user's data.

**Do the counters first.** They are already in the branch, they cost nothing,
and if they show cache counts flat while rss climbs, none of the above is worth
doing because the hypothesis is already refuted.

## Cheap wins available regardless

- **Set a memory limit** on both frontend containers. Even a generous one
  (2 GB) converts an unbounded climb into a restart with a clear signal,
  instead of quiet host pressure. This is a compose change and needs your
  approval; I have not made it.
- **Reclaim rollback images.** Ten `rollback-*` tag pairs at 1.5 GB each,
  roughly 15 GB, going back to 2026-09-01. Unrelated to memory, but it is the
  same host and the günlük already tracks disk growth as an open item.
