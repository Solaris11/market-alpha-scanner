# Phase 12.4 Unified Simple Home / Console

Date: 2026-05-10

Final status: UNIFIED SIMPLE CONSOLE READY

## Objective

Make the main Terminal screen answer the user's real questions without forcing them through every intelligence layer:

- What matters now?
- What are the best opportunities?
- What is dangerous?
- What changed?
- What should I watch?

## What Changed

### Simple Console

The Terminal version of `UnifiedIntelligenceConsole` now renders a simplified home console instead of the dense institutional console layout.

The simplified console shows:

- Market state
- Top opportunities
- Top risks
- What changed
- Shock watch
- Watchlist changes
- What to watch next

The deeper priority queue, event pressure, fragility, asymmetry, since-last-visit, and grounding details remain available inside an `Advanced intelligence details` disclosure.

### Advanced Panels Moved Behind One Drawer

The Terminal page previously stacked many panels directly after the daily action and unified console:

- Live Intelligence
- Automated Research Agents
- Market Tape
- Monitoring Brief
- Intraday Regime Drift
- Regime Shift Intelligence
- Adaptive Learning
- Strategy Intelligence
- Scenario Intelligence
- Execution Intelligence
- Workflow Evolution
- Institutional Intelligence
- Risk-Tolerant Radar
- Shock Radar
- Command Center / Market Regime Radar

These are now grouped under one `Advanced intelligence layers` disclosure. They are still reachable, but they no longer compete with the main answer.

### Duplicate Warning Reduction

The separate `Decision Lock` warning card was removed from the default Terminal stack. Daily Action and the simplified console already communicate the risk-first state, so repeating another large warning increased anxiety without adding much clarity.

## Before / After

| Area | Before | After |
| --- | --- | --- |
| Main Terminal stack | Daily action plus many intelligence panels competing for attention | Daily action plus one simple console, with advanced layers collapsed |
| Unified Console | Large priority queue, metric grid, context stack, changes, grounding all visible | Six-question summary visible; deep proof behind disclosure |
| Shock/risk-tolerant content | Separate cards in the main stack | Summarized in console; full radar behind advanced drawer |
| Repeated warnings | Daily Action plus Decision Lock plus risk-oriented cards | Daily Action plus calm risk context in console |
| User first read | Dense and dashboard-like | Focused on what matters, best opportunities, risks, changes, and watch items |

## Current Information Hierarchy

### Must See

- Today's action
- What Matters Now
- Best Opportunities
- Dangerous Now
- Market State
- What Changed
- Shock Watch
- Watchlist Changes

### Drill Down

- Best Trade Now card when trade UI is not blocked
- Research queue
- Signal heatmap
- Watchlist widget
- Paper simulation pulse

### Advanced

- Live intelligence
- Research agents
- Regime drift
- Adaptive learning
- Strategy/scenario/execution panels
- Institutional intelligence
- Shock/risk-tolerant full radars
- Market tape
- Command center metrics

## UX Impact

The Terminal should now feel calmer and more focused:

- Users can see the primary answer before opening advanced detail.
- Advanced intelligence remains available without dominating the default route.
- The page is less warning-heavy.
- The main screen better matches the Phase 12 simplification principle: deep but simple.

## Screenshots

Captured screenshots:

- `artifacts/phase-12-4-unified-simple-console/screenshots/terminal-simple-public-desktop.png`
- `artifacts/phase-12-4-unified-simple-console/screenshots/terminal-simple-public-mobile.png`

Reference before screenshot:

- `artifacts/phase-12-2-product-simplification/screenshots/terminal-desktop.png`

Screenshot limitation:

The local authenticated premium path could not be captured because the local auth/rate-limit path failed closed during screenshot capture. The public screenshots verify the reachable Terminal shell and first-run presentation. The premium simplified console path is covered by TypeScript and production build validation.

## Remaining UX Clutter

- The public/free Terminal still shows Start Here, Daily Action, and locked Premium preview together. That is acceptable for beta, but the locked preview could eventually be made shorter.
- Desktop navigation still exposes some advanced destinations directly. Phase 12.2 recommended moving low-frequency routes under More / Advanced.
- Symbol detail remains deep and should be simplified into Overview, Timing, Evidence, and Journal.
- The beta feedback widget can overlap the bottom mobile navigation.
- Premium screenshot coverage should be repeated when local auth/DB health is available.

## Validation

- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- No scanner jobs were run.
