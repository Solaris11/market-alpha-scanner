# Phase 13.2b Navigation + Route Performance Hardening

Date: 2026-05-12

## Executive Summary

Navigation hardening focused on perceived speed rather than only raw route latency. The main beta complaint was that major route changes felt unfinished or laggy even when server timings were acceptable.

Implemented:
- High-priority route prefetching from the terminal shell.
- Immediate route-transition feedback when users click major navigation links.
- Stable shell-like loading skeletons so route transitions keep the product frame visible.
- New `/paper` loading fallback.
- Unified Strategy Labs loading with the common shell skeleton.
- Opportunities workspace defers secondary intelligence panels until after primary ranked opportunities and only mounts the heavy advanced panel after the user opens it.
- Opportunities tab/filter changes now use deferred filtering so tab clicks and input changes remain responsive while the visible list catches up.

## Slow-Route Root Causes

Observed code-level causes:
- Major app routes are dynamic and entitlement-gated, so route transitions wait for server data before the final page appears.
- `/terminal`, `/opportunities`, `/dashboard`, and `/strategy-labs` synthesize several intelligence layers before rendering the full page.
- Previous route loading states did not preserve enough of the real terminal shell, which made transitions feel more disruptive.
- `/paper` had no route-level loading fallback even though it performs portfolio, analytics, scenario, and paper-trade work.
- Opportunities rendered advanced intelligence sections before the ranked universe, pushing secondary analytics ahead of the primary user task.
- Opportunities filtering and tab changes recomputed visible rows synchronously on the active state.

## Changes Applied

Files changed:
- `frontend/src/components/terminal/NavigationPerformance.tsx`
- `frontend/src/components/terminal/TerminalShell.tsx`
- `frontend/src/components/terminal/TerminalNav.tsx`
- `frontend/src/components/top-nav.tsx`
- `frontend/src/components/terminal/RouteLoadingSkeleton.tsx`
- `frontend/src/app/paper/loading.tsx`
- `frontend/src/app/strategy-labs/loading.tsx`
- `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx`
- `frontend/src/components/ui/ResponsiveAdvancedDetails.tsx`
- `frontend/src/app/globals.css`

## Prefetch + Transition Feedback

Added shell-level idle prefetch for high-traffic routes:
- `/terminal`
- `/opportunities`
- `/performance`
- `/history`
- `/dashboard`
- `/paper`
- `/strategy-labs`
- `/mobile`
- `/account`

Desktop nav, mobile drawer nav, bottom nav, mobile focus shortcuts, and legacy top nav now prefetch on hover/focus and dispatch immediate route-start feedback on normal clicks.

User-visible effect:
- The app responds immediately when a route is selected.
- A thin institutional progress bar appears at the top during route transition.
- Desktop shows a small contextual "Opening ..." status pill.

## Loading Skeleton Improvements

The common route skeleton now preserves a lightweight TradeVeto shell header and nav structure. This avoids the feeling that the product disappears during route transitions.

Added `/paper/loading.tsx` because `/paper` is one of the heavier beta workflows and previously lacked a route-level loading state.

Strategy Labs now uses the same shell-preserving skeleton instead of a one-off panel-only loading screen.

## Lazy / Deferred Changes

Opportunities:
- Primary top setup and ranked scanner universe now appear before secondary intelligence panels.
- Heavy advanced intelligence panels are deferred with `ResponsiveAdvancedDetails deferMount`.
- Filter/tab result computation uses `useDeferredValue`.
- Users see `Updating view...` during deferred filter transitions instead of a frozen UI.

Responsive advanced details:
- Added optional `deferMount` support for advanced panels that should not hydrate or render until opened.

## Timing Results

Recent production baseline from the prior production smoke gate, before this hardening was deployed:

| Route | Status | Latency |
| --- | ---: | ---: |
| `/terminal` | 200 | 147ms |
| `/dashboard` | 200 | 218ms |
| `/opportunities` | 200 | 287ms |
| `/paper` | 200 | 155ms |
| `/strategy-labs` | 200 | 169ms |
| `/history` | 200 | 107ms |
| `/api/health/deep` | 200 | 354ms |

Local production-build smoke after this hardening:

| Route | Status | Latency |
| --- | ---: | ---: |
| `/terminal` | 200 | 97ms |
| `/opportunities` | 200 | 24ms |
| `/history` | 200 | 15ms |
| `/strategy-labs` | 200 | 14ms |
| `/dashboard` | 200 | 14ms |
| `/paper` | 200 | 19ms |
| `/performance` | 200 | 14ms |
| `/api/health` | 200 | 9ms |
| `/api/health/deep` | 503 | 8ms |

Notes:
- The local route smoke is unauthenticated and not directly comparable to production premium-user route costs.
- Local `/api/health/deep` returned 503 because local DB/backup/scanner production dependencies are not available. This is not a navigation regression.
- The largest user-facing improvement is perceived speed: prefetch, immediate transition feedback, stable skeletons, and delayed secondary panels.

## Validation Results

Passed:
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- Local production-build route timing smoke for major beta routes

Test count:
- 371 frontend tests passed.

## Remaining Bottlenecks

Still not fully solved:
- Premium authenticated route timings should be measured in production after deploy because local unauthenticated routes do not exercise the full premium intelligence payload.
- `/terminal` still computes many intelligence systems server-side before final render.
- `/dashboard` and `/strategy-labs` still build full deterministic models synchronously server-side.
- The app does not yet split terminal primary summary data from secondary intelligence data at the API boundary.
- No browser-level hydration profiling was run in this pass.

## Urgent Production Bug Follow-Up

After beta visual QA, `/performance` produced a browser-level "This page couldn't load" failure for a premium session. Production logs showed the Next.js process had previously restarted from a JavaScript heap out-of-memory event.

Root cause:
- `/performance` used `getIntradaySignalDriftSummary()`.
- That summary path loaded the full historical `scanner_signals` table from Postgres when DB access was available.
- Production had roughly 224k historical signal rows, including payload columns, so one premium performance route could push the Next process near the heap limit.

Fix:
- `getIntradaySignalDriftSummary()` now uses the bounded recent-history query already used by live route surfaces.
- CSV fallback was split into `getCsvIntradaySignalDriftSummary()` so DB-backed summaries no longer fall back into an unbounded DB read.
- The fix keeps the drift widget useful while preventing `/performance` from loading full historical signal payloads.

## Next Recommendations

P1:
- Deploy this hardening and rerun production performance budget checks as an authenticated beta user.
- Add route transition analytics: click timestamp, first usable UI, and route complete timestamp.
- Add production RUM for route changes and mobile route transitions.

P2:
- Split terminal data into primary console payload and secondary intelligence payload.
- Add API-backed lazy panels for dashboard heatmaps, Strategy Labs trade history, and replay deep metrics.
- Use bundle analyzer to identify client component and chart costs.

Final status:
NAVIGATION PERFORMANCE HARDENING COMPLETE
