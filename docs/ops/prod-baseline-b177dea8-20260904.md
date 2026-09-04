# Production baseline before the actionability deploy

Captured 2026-09-04 02:35-02:45 UTC against prod `b177dea8`, signed in as
`perf-test@tradeveto.com` (premium, beta). No mutation; every value below is a
read.

## The regression, shown rather than argued

Two pages render the same two radar components from the same scanner data.
`/opportunities` passes unstripped rows. `/terminal` passes rows that Stage 1
stripped. The same field, in each page's flight payload:

`/opportunities`
```
"outcomeStatus":"complete","preconditions":{"atrPercent":2.461,"closeVsMa20Pct":-2.736,
"closeVsMa50Pct":-2.86,"compressionPercentile":66.07,"gapPercent":2.997, ...}
```

`/terminal`
```
"outcomeStatus":"complete","return1d":3.855,"return2d":-0.085,"return3d":-0.138, ...
```

No `preconditions` key. Counted across the whole payload:

| | `/opportunities` | `/terminal` |
|---|---:|---:|
| `preconditions` occurrences | 12,882 | 532 |
| of which `commonPreconditions` (a summary field, not per-event) | — | 355 |
| `shockEvents` occurrences | 355 | 355 |

So the per-event preconditions are gone on `/terminal` and the array is not.

The calibration behind the five rendered strings reads those preconditions.
With them gone, every card degrades to the same answer. All five cards visible
on `/terminal`:

```
Watch only: Early; needs confirmation
This needs more confirmation before it becomes clean. Look for relative-volume
confirmation rather than isolated price movement.
Breaks if: The setup weakens if price loses $<symbol-specific> area.
Historical chase success is limited at 0% in comparable shock samples.
```

| Field | Distinct values across 5 cards |
|---|---|
| primary action line | 1 — `Watch only: Early; needs confirmation` |
| action context | 1 |
| historical chase success | 1 — **0%**, for every symbol |

Only the invalidation price varies, because that comes from the row rather than
from the shock calibration. A working calibration varies by symbol; 0% for
every symbol is the fingerprint of an input that is no longer there.

**This is what `98afc6c6` repairs**, and it is the value to re-read after the
deploy: the chase-success percentages should differ between symbols, and the
primary action line should stop being one string repeated five times.

## Page metrics, `/terminal`, premium, warm

| Metric | Value |
|---|---:|
| responseStart | 182 ms |
| responseEnd | 2,659 ms |
| DOM interactive | 2,771 ms |
| loadEventEnd | 2,786 ms |
| transfer size | 1,700,122 B |
| decoded HTML | 13,837,994 B |
| flight payload | 12,180,208 chars |
| body text | 135,725 chars |

## Provider and debug fields in the client payload

| Key | Occurrences |
|---|---:|
| `alpaca_request_id` | **0** |
| `polygon_request_id` | **0** |
| `finnhub_` | **0** |
| `tiingo_` | **0** |
| `provider_debug` | **0** |
| `_debug` | **0** |

Priority 2's "provider/debug alanları payload'da 0 kalmalı" holds on the
current deploy. This is the number to re-check after any deploy.

## API calls per `/terminal` load

| Endpoint | Calls |
|---|---:|
| `/api/user/watchlist` | **2** |
| `/api/discovery` | **2** |
| `/api/analytics/events` | 2 |
| `/api/auth/csrf` | 1 |
| `/api/auth/me` | 1 |
| `/api/legal/status` | 1 |
| `/api/notifications` | 1 |
| `/api/user/risk-profile` | 1 |
| `/api/user/workflow-visit` | 1 |
| `/api/user/workspace-preferences` | 1 |

`/api/user/watchlist` at 2 is the duplicate `345997e0` fixes; it should read 1
after that commit ships.

`/api/discovery` at 2 is **not** a duplicate, and I am correcting my own first
reading of it. `GlobalIntelligenceDiscovery` fetches the initial packet, then
requests `?packet=full` only when the initial one is a strict subset of the
universe. That is deliberate progressive loading and both responses are used.
It should stay at 2.

It is also the reason `discoverySystemCache` holds two entries per account
rather than one -- the keys are `user:<id>:initial` and `user:<id>:full` -- which
is the cache the memory work bounds. The two findings corroborate rather than
conflict.

## Container state at capture

```
market-alpha-frontend                        running  Up 8 hours (healthy)
market-alpha-frontend-hot-api                running  Up 8 hours (healthy)
market-alpha-scanner-market-alpha-postgres-1 running  Up 2 months (healthy)
```

## Addendum, 10:00–10:14 UTC: a memory measurement that changed the diagnosis

A read-only load experiment on this same deploy, as one already-authenticated
test account.

| Step | frontend memory |
|---|---:|
| idle, three samples across 7h11m | 1.116 / 1.117 / 1.117 GiB |
| after 14 `/api/discovery` fetches, all cache hits | 1.117 GiB — unchanged |
| after 8 full `/terminal` renders (106 MB of HTML) | **1.222 GiB — plus 105 MB** |
| 2.5, 5 and 7 minutes idle afterwards | 1.222 GiB — not released |

About 13 MB retained per render, against a 13.8 MB document. At that rate the
+491 MB the 24-hour observation recorded is roughly 38 page loads, which is an
ordinary day here.

This **withdraws** the explanation I committed a few hours earlier.
`discoverySystemCache` being unbounded is real, but I had assumed its entries
were megabytes each; measured, the serialized discovery system is 255 KB for
the full packet and 23 KB for the initial one. Sixty-six entries is ~20 MB, not
hundreds. Capping it is still right — an unbounded cache is a defect whatever
its size — but it is not the cause.

What the numbers point at instead is the per-render cost of the document
itself, which makes **Stage 3 the memory lever**: it removes 4.7 MB of
`shockEvents` from a 13.8 MB response, and if retention tracks payload size it
should cut this by about a third. That is a prediction, and the experiment
above is four minutes long and repeatable, so re-run it after Stage 3 deploys
rather than taking my word for it.

Full detail in `docs/ops/memory-follow-up-plan.md`.
