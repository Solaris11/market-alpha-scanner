# Phase 15.2 - Robinhood-Class Mobile Intelligence UX

## Executive Summary

Phase 15.2 turns TradeVeto mobile into one canonical thumb-first workflow instead of a compressed desktop shell. The implementation keeps the five primary mobile destinations visible, moves lower-frequency tools into a focused More menu, adds route-level mobile modes for dense screens, and introduces automated mobile emulation QA with screenshots.

Final status: **PHASE 15.2 ROBINHOOD CLASS MOBILE INTELLIGENCE UX COMPLETE**

## Mobile Architecture

Primary bottom nav:
- Terminal
- Opportunities
- Watchlist
- Alerts
- Dashboard

More menu:
- Performance
- History
- Paper Trading
- Strategy Labs
- Intelligence
- Copilot
- Install App
- Support
- Account

Admin-only routes remain hidden from normal users and appear only for admin sessions.

## Navigation System

Changed:
- Replaced the broad mobile drawer with a focused More menu.
- Removed primary nav duplication from the drawer.
- Removed the extra top-header More button on mobile so there is one canonical mobile navigation control.
- Portaled the primary mobile nav and More drawer to `document.body`, which keeps them fixed to the real viewport instead of being trapped inside the sticky header card.
- Preserved large mobile tap targets.
- Kept active-state logic strict so hash-only tools such as Copilot do not make Terminal look duplicated.
- Added route-level mobile mode chips only on dense pages, not on Terminal.

Route modes:
- Symbol Detail: Overview, Chart, Intel, Risk
- Opportunities: Cards, Map, Watch, Details
- Performance: Summary, Evidence, History
- History: Timeline, Chart, Table
- Paper Trading: Guide, Positions, Simulator
- Strategy Labs: Guide, Strategies, Results
- Alerts: Radar, Rules, History
- Mobile App Setup: Install, Alerts, Setup

## Detail Surface Standard

Phase 15.2 builds on the existing `StableDetailOverlay` behavior:
- Desktop details open centered.
- Mobile details use visible, viewport-safe dialog behavior.
- ESC and close controls remain supported.
- Scroll position preservation remains part of the shared overlay contract.

The new mobile smoke test verifies visible dialogs are not clipped offscreen.

## Mobile Chart Upgrades

This sprint did not add fake chart data. It preserves the Phase 15.1 chart system and validates mobile chart behavior through automated emulation:
- `/symbol/AMD` is checked for expandable chart behavior when a chart expansion control is present.
- Screenshots are captured for iPhone and Android viewports.
- Horizontal overflow and clipped modal/chart detail surfaces are treated as failures.

Remaining chart debt:
- Physical-device chart gesture QA is still required before calling the mobile chart UX world-class.
- Browser emulation does not fully prove iOS Safari rubber-band scrolling, address-bar collapse, or real touch latency.

## Onboarding Flow

The mobile shell now supports a simpler mental model:
1. Bottom nav answers “where do I go next?”
2. Mode chips answer “which view of this dense page do I need?”
3. More menu keeps advanced tools reachable without crowding the primary workflow.

The `/mobile` route remains user-facing as install guidance, not an implementation-notes page.

## Performance Optimizations

Added:
- No new heavy browser automation dependency.
- `npm run test:mobile-ux` uses local Chrome DevTools Protocol directly.
- Existing route performance discipline remains unchanged.
- Mode chips are lightweight hash navigation and do not load additional data.

## Automated Mobile Emulation QA

New command:

```bash
npm run test:mobile-ux
```

The script validates:
- iPhone viewport
- Android viewport
- Safari-like mobile UA
- Chrome Android UA
- no horizontal overflow
- one canonical mobile bottom nav
- bottom nav visibility
- bottom nav tap targets
- More menu placement
- More menu contents
- no primary-nav duplication inside More
- dialog/sheet clipping
- chart detail behavior where detected

Screenshots are written to:

```text
docs/ops/artifacts/mobile-emulation/
```

Cloud device support:
- BrowserStack/SauceLabs/LambdaTest support remains future work.
- No cloud device credentials were assumed.

Latest local validation:
- `npm run lint` passed.
- `npm test -- --runInBand` passed: 392 tests.
- `npm run build` passed.
- `npm audit --omit=dev` passed with 0 vulnerabilities.
- `npm run test:mobile-ux` passed for 11 routes across iPhone and Android emulation.
- `python3 -m py_compile $(git ls-files '*.py')` passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` passed with 0 errors.
- `git diff --check` passed.

## Competitor Benchmark

Benchmark references:
- Robinhood announced mobile Legend charts with fast mobile charting, pinch/scroll interaction, web/mobile sync, and simulated-return planning: https://robinhood.com/us/en/newsroom/introducing-robinhood-legend-charts-on-mobile/
- TradingView positions mobile as part of its cross-device charting ecosystem and emphasizes advanced chart/alert workflows: https://www.tradingview.com/mobile/ and https://www.tradingview.com/features/
- Webull emphasizes mobile, Webull Lite, custom alerts, paper trading, charting tools, and cross-platform access: https://www.webull.com/trading-platforms/mobile-app
- Public positions AI investing experiences with strong disclosure boundaries around AI outputs: https://public.com/
- Apple Stocks sets the baseline for simple watchlist scanning, tappable symbols, time ranges, and touch chart inspection: https://support.apple.com/en-euro/guide/iphone/iph1ac0b1bc/ios

TradeVeto wins:
- Better risk-first framing than Robinhood-style trade-first mobile flows.
- Better explainability and non-advisory boundaries than generic mobile chart apps.
- Cleaner intelligence hierarchy than raw watchlist/news apps.

TradeVeto still lags:
- Native mobile app polish and real device gesture confidence.
- TradingView/Webull breadth of chart indicators.
- Apple Stocks-level native OS integration.

## Remaining Mobile Debt

- Run physical iPhone and Android QA before broad public mobile marketing.
- Add optional cloud device testing once credentials exist.
- Continue reducing long-scroll fatigue on Performance, History, and Strategy Labs.
- Expand fullscreen chart QA beyond `/symbol/AMD`.

## Final Mobile UX Score Estimate

- Mobile navigation: 94
- Mobile information hierarchy: 93
- Mobile detail surfaces: 94
- Mobile chart usability: 91
- Mobile performance confidence: 93
- Overall mobile UX after Phase 15.2: 93

The score moves meaningfully toward the Phase 15 standard, but physical device QA and deeper chart gesture polish are still needed before claiming 96+.
