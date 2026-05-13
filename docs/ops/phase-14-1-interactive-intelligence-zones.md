# Phase 14.1 - Interactive Intelligence Zones

## Summary

Phase 14.1 converts the main TradeVeto intelligence blocks from static dashboard sections into clickable, explainable intelligence zones.

The shared drawer system now supports:

- centered detail modals on desktop and mobile
- related-symbol chips
- clickable symbol links from related chips and symbol mentions
- "what to monitor next" guidance
- scored factor strips
- explicit data source and timestamp
- honest limited-evidence states when scored data is unavailable

## P0 Drawer Fix

Beta feedback found that clicking Market State could blur the page without showing the detail panel. The issue was treated as P0 because the same shared drawer powers the Phase 13.5 interactive cards.

Fix:

- replaced the right-side drawer with a centered modal so details stay visible on desktop and mobile
- raised the overlay layer to `z-[10000]`
- kept the blurred backdrop across unused screen space
- added Escape-key close behavior
- kept the existing click-outside close behavior

This fix applies to every shared `InteractiveInsightZoneGrid` usage:

- Terminal / dashboard console zones
- Opportunities visual command center
- Alerts visual center
- Performance validation zones

## P0 Symbol Link Fix

Related symbols in detail panels are now real links to `/symbol/{ticker}`. The drawer also links matching symbol mentions inside detail summaries, "why this is shown" bullets, and "what to monitor next" text when those symbols are part of the zone's related-symbol set.

This applies to:

- Terminal zones such as Best Setups, Dangerous Now, Shock Watch, What Changed, Watchlist, Risk Review, and Macro Pressure
- Opportunities zones such as Best Stack, Shock Potential, Risk Watch, Watchlist, and What Moved
- Any future shared intelligence zone that supplies `relatedSymbols`

## New Intelligence Zones

The terminal and dashboard now expose ten clickable zones:

- Market State
- Best Setups
- Shock Watch
- Dangerous Now
- Watchlist Intelligence
- What Changed
- Risk Review
- Volatility Pressure
- Macro Pressure
- Replay Context

Each zone includes:

- icon and short label
- real data-backed status or honest empty state
- visual metric indicator when a score is available
- source data description
- factor breakdown when scored fields exist
- related symbols when available
- monitoring guidance
- full-detail link where the platform already has a route

## Data Mapping

Zones are powered by the unified console model, not placeholder arrays.

- Market State: macro regime summary, attention, decision, risk, fragility
- Best Setups: top opportunity queue, opportunity score, timing, decision quality
- Shock Watch: shock-condition briefings, risk, fragility, attention
- Dangerous Now: top risk queue, risk score, urgency, timing
- Watchlist Intelligence: watchlist workflow changes
- What Changed: workflow evolution and scanner delta briefings
- Risk Review: risk metric, fragility metric, top risk row
- Volatility Pressure: shock watch, fragility, risk-pressure metrics
- Macro Pressure: macro regime, event pressure, fragility briefings
- Replay Context: best asymmetry and workflow-change context

If a zone lacks enough scored evidence, the drawer states that evidence is limited instead of rendering fake charts.

## Mobile Behavior

The shared drawer uses the same centered modal layout on small screens and desktop:

- large close button
- full-width panel with viewport-safe margins
- no horizontal overflow
- scrollable content within viewport
- clear related-symbol and monitor-next sections

## Validation Notes

Local validation passed:

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Headless local click automation could not see protected/data-backed zones because the local unauthenticated routes rendered zero zone buttons. Production smoke is required after deploy because production has the authenticated scanner data path.

## Remaining UX Debt

- Market State detail does not yet include a dedicated multi-instrument chart panel for SPY, QQQ, DIA, BTC, GLD, USO, UUP, and TLT. It now avoids fake proxy visuals and uses available console data only.
- Future Phase 14 work should add a real market-detail drawer backed by validated price and macro feeds.
- Additional pages can progressively adopt the related-symbol and monitor-next fields, but the shared drawer now supports them globally.
