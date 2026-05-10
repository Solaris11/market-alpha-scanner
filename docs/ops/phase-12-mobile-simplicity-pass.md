# Phase 12.7 Mobile Simplicity Pass

## Scope

This pass focused on mobile workflow clarity across the routes users are most likely to revisit during beta:

- Terminal / dashboard shell
- Opportunities
- Symbol detail
- Alerts
- Strategy Labs
- Mobile/PWA page
- Onboarding entry points

## What changed

- Added a mobile focus strip under the terminal header with one-tap paths to `What matters`, `Opportunities`, `Watchlist`, `Alerts`, and symbol search.
- Collapsed secondary opportunity intelligence behind an advanced disclosure on small screens while keeping it available and open on desktop.
- Kept the opportunity card list closer to the top of the phone viewport by moving advanced market, shock, strategy, scenario, and institutional panels behind a mobile-friendly disclosure.
- Simplified opportunity filtering on mobile: search, decision, sort, and watchlist remain visible; asset, sector, setup, score, conviction, entry, and quality filters move into `More search filters`.
- Improved symbol detail ordering by keeping the decision assistant, decision intelligence, evidence, and narrative visible first, then placing secondary research systems behind `More symbol intelligence`.
- Collapsed Strategy Labs simulated trade history into a responsive disclosure so mobile users see mode, summary, curve, and open model positions first.
- Moved custom alert creation behind a responsive disclosure so alert status and presets stay primary on mobile.
- Moved PWA/push setup behind the main mobile decision inbox for premium mobile users.
- Added a watchlist anchor target so mobile users can jump directly to tracked symbols.

## Before / after usability

Before:

- Mobile opportunities could show many intelligence systems before the actual ranked cards.
- Symbol detail put timing tools lower after several secondary panels.
- Alerts showed manual rule creation as prominently as presets.
- Mobile/PWA setup content appeared before the actual decision inbox.

After:

- Primary mobile flow is now: what matters, opportunities, watchlist, alerts, symbol detail.
- Secondary research remains available without dominating the first scroll.
- Common mobile actions have larger touch targets and safer wrapping.
- Advanced detail is preserved for desktop and for users who choose to expand it on mobile.

## Validation plan

- iPhone viewport: `/terminal`, `/opportunities`, `/symbol/AMD`, `/history`, `/strategy-labs`, `/mobile`.
- Android viewport: same routes at a narrow/tall viewport.
- Small viewport: 360px wide overflow check.
- Landscape: 812x375 route checks for navigation and filter usability.

## Validation results

- Production-mode mobile screenshots were captured after build with the anonymous legal acknowledgement hidden through local storage.
- Checked `/terminal`, `/opportunities`, `/symbol/AMD`, `/mobile`, and `/terminal` landscape.
- Horizontal overflow checks passed:
  - 390px iPhone routes: `scrollWidth === clientWidth`.
  - 360px small mobile route: `scrollWidth === clientWidth`.
  - 812x375 landscape route: no horizontal overflow.
- Route checks returned `200` for `/terminal`, `/dashboard`, `/opportunities`, `/symbol/AMD`, `/history`, `/strategy-labs`, `/mobile`, `/alerts`, and `/api/health`.
- `/api/health/deep` returned `503` in this local environment because the database-backed health dependencies are not configured locally.

## Screenshot artifacts

- `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-7-mobile-simplicity/terminal-iphone-final.png`
- `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-7-mobile-simplicity/opportunities-iphone-final.png`
- `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-7-mobile-simplicity/symbol-amd-iphone-final.png`
- `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-7-mobile-simplicity/mobile-small-final.png`
- `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-7-mobile-simplicity/terminal-landscape-final.png`

## Remaining mobile pain points

- Some chart-heavy panels still need deeper mobile-specific chart summarization.
- Strategy Labs can still feel dense when many simulated trades exist, although the trade log is now optional.
- The historical replay table/list surfaces should eventually get a dedicated compact mobile replay card.
- True native app push behavior still requires the later native-app phase.
