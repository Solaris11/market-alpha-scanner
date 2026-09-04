# Frontend memory: what I found, and the 48–72h plan

Written 2026-09-04. The 24-hour stability observation recorded the frontend
container growing **+491 MB against a +50 MiB budget**. This is the follow-up.

## What the numbers actually say

Three samples over 20 minutes today, prod `b177dea8`, container up ~8h with
`restarts=0`:

| UTC | frontend | hot-api |
|---|---:|---:|
| 02:36:39 | 1.185 GiB | 143.2 MiB |
| 02:49:12 | 1.116 GiB | 144.5 MiB |
| 02:49:03 (later poll) | 1.117 GiB | 147.2 MiB |

**It went down.** Whatever is happening is not a straightforward monotonic
leak — GC does release, and the container plateaus around 1.11–1.19 GiB at the
current (very low) traffic level. Read the +491 MB as a rising high-water mark,
not as 491 MB of permanently retained objects. Those need different fixes and I
do not yet have the data to say which one this is.

Also worth knowing: **neither frontend container has a memory limit.**
`docker inspect` reports `mem_limit=0` on both. On a 31 GB host there is no
cgroup ceiling, so nothing forces GC pressure and nothing bounds the blast
radius if it ever does run away.

## What I found by reading

Every module-level cache in the frontend caps its entries and evicts the
oldest — market memory at 160, decision replay, paper data, developer
intelligence, saved scans, the discovery route's body and response caches.
With one exception.

`discoverySystemCache` in `src/lib/server/discovery-intelligence.ts`:

- keyed `user:<id>:<packetMode>`, so it grows with the number of distinct
  accounts that have ever loaded discovery, **two entries each** (the client
  fetches an initial packet then a full one, by design);
- **no size cap and no sweep**. `expiresAt` and `staleUntil` govern freshness,
  not residency, so nothing ever left the map;
- its values are the largest in the process: each entry holds the resolved
  system object graph *and* its serialization, and a serialized system is
  megabytes of string — `/terminal`'s flight payload measures 12.2M characters
  today;
- the background refresh eagerly built **both** `serializedFull` and
  `serializedInitial` on every refresh, so each entry also carried a
  multi-megabyte string for a packet mode that key never serves.

With 33 user rows on the database, the ceiling is roughly 66 entries of
multi-megabyte values. That is the right order of magnitude for the observed
number, which is why it is the leading hypothesis — but order-of-magnitude
agreement is not proof, and I want to be clear that I have not demonstrated
causation.

`f6d9e1ea` bounds it (cap 24, stale-first eviction, a pin for entries with a
refresh in flight) and makes the serialization lazy again. Neither change
alters what is computed; both only affect what is retained.

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

1. **Baseline at t=0.** Record `rss`, `heapTotal`, `heapUsed`, `external`, and
   each cache count immediately after the container starts. The container
   healthcheck already polls `/api/health` every 30s and the stability observer
   every 60s, so no new load is added.
2. **Sample every 15 minutes for 72 hours.** The existing stability observer
   pattern is the right vehicle; it already writes JSON lines and it already
   has a supervised transient-unit form on the relay's allowlist.
3. **Read it as three questions, in order:**
   - Does `discoverySystem` sit at its cap of 24? If it never reaches the cap,
     the cache was never the ceiling and the hypothesis is dead.
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
