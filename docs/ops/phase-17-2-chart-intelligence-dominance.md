# Phase 17.2 - Chart Intelligence Dominance

## Objective

Close the remaining chart workflow gap against TradingView and TrendSpider by making TradeVeto charts intelligence-native instead of generic analytics charts.

The implementation focuses on validated chart data only. No fake price history, synthetic replay events, fabricated macro events, or unsupported chart annotations are drawn.

## Implemented Systems

### Symbol Chart Intelligence Overlay System

Primary implementation:

- `frontend/src/components/terminal/SymbolChart.tsx`
- `frontend/src/components/terminal/chart-intelligence-overlays.ts`
- `frontend/src/components/terminal/symbol-chart-marker-policy.ts`

Added synchronized overlay families:

- Replay
- Macro
- Risk
- Events
- Confidence
- Market Memory
- Research levels

Each family can be toggled independently from the chart surface. The overlays are synchronized with the validated candle timeframe and disappear when evidence is unavailable or filtered out.

### New Marker Types

Expanded chart marker vocabulary:

- `BREAKOUT`
- `FAILURE`
- `MEMORY`
- `SHOCK`
- `VOLATILITY`

Existing markers still support:

- Alert
- Confidence
- Contradiction
- Entry/exit/wait
- Event
- Freshness/stale
- Macro
- Replay
- Risk
- Stop/target

### Data-Backed Intelligence Zones

The chart now draws cinematic shaded zones from real data:

- Risk escalation zones from risk, shock, stale, contradiction, volatility, stop, and failure markers
- Macro zones from current macro adjustment context
- Replay zones from replay/analog evidence
- Market Memory zones from validated analog similarity
- Event zones from event risk and shock pressure
- Breakout zones when validated price exceeds scanner entry context
- Failure zones when validated price approaches scanner invalidation context
- Volatility expansion zones when recent validated candle ranges exceed trailing range baselines
- Entry/stop/target zones from scanner-provided trade context

### Fullscreen Chart Exploration

Expanded chart mode now behaves as a cinematic research surface:

- Larger overlay container with stable scroll preservation
- Multi-timeframe switching
- Synchronized overlay controls
- Research-only level overlays
- Overlay evidence list
- Chart narrative panel
- Compare mode
- Replay timeline mode

Fullscreen modes:

- `overlays`: explains why the chart matters
- `compare`: compares price move, risk overlays, macro overlays, replay/memory context, and level sync
- `timeline`: shows chronological marker evidence from scanner, macro, replay, memory, risk, and confidence systems

### Symbol Detail Marker Generation

Primary implementation:

- `frontend/src/components/terminal/SymbolTerminalWorkspace.tsx`

Chart markers are now generated from real scanner and intelligence fields:

- Event risk
- Volatility pressure
- Shock / large-move pressure
- Fragility
- Macro adjustment
- Contradiction checks
- Replay quality
- Market Memory similarity
- Validated price vs entry context
- Validated price vs invalidation context
- Validated price vs target context
- Data freshness
- Historical decision and score-change history

Symbol Detail now shows intelligence overlays by default, with an explicit "Hide intelligence overlays" control.

### Market / Cross-Asset Chart Intelligence

Primary implementation:

- `frontend/src/components/charts/InteractivePriceChart.tsx`

The lighter SVG chart used for market and cross-asset surfaces now includes data-derived zones:

- Breakout pressure
- Failure pressure
- Volatility expansion
- Momentum shift

Expanded chart detail explains the validated chart intelligence narrative instead of showing only a line and percentage move.

## Chart Storytelling

Charts now explain why the visual state matters:

- Risk layer active
- Macro context attached
- Historical memory visible
- Confidence evolved on-chart
- Breakout context detected
- Failure boundary nearby
- Volatility expanding
- Price-only range when no synchronized evidence exists

The wording stays research-first and avoids predictive or advisory language.

## Mobile Behavior

The chart controls and expanded overlay use existing stable overlay infrastructure:

- Bottom-sheet behavior on mobile
- Safe-area padding
- Drag-to-close
- Scroll preservation
- Touch-friendly overlay chips
- Horizontal chip scrolling for small screens
- No route navigation required to inspect chart details

Manual physical-device QA is still recommended for iPhone Safari, Android Chrome, and Facebook in-app browser after production deployment.

## Validation

Local validation performed:

- `npm --prefix frontend run lint` - passed
- `npm --prefix frontend test -- --runInBand` - passed, 414 tests
- `npm --prefix frontend run build` - passed
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors
- `git diff --check` - passed
- Local browser smoke on `/symbol/AMD` - route rendered without application crash; local scanner data was unavailable, so the authenticated populated chart state still requires production/data-backed QA

Remaining validation recommended before release sign-off:

- Production/data-backed browser smoke on `/symbol/AMD` and macro/chart surfaces
- Physical-device QA on iPhone Safari, Android Chrome, and Facebook in-app browser

## Remaining Chart Debt

- This does not clone full TradingView drawing tools, advanced indicators, or custom user annotations.
- Compare mode is intelligence comparison, not yet a full multi-symbol synchronized chart canvas.
- Macro/event overlays depend on available scanner fields and do not fabricate missing event sources.
- Physical-device mobile QA remains a release requirement.
- Production deployment screenshots should be captured after push/redeploy if this phase is promoted directly to production.

## Verdict

TRADEVETO CHART INTELLIGENCE DOMINANCE ACCOMPLISHED
