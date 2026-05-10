# Phase 12.6 Opportunity Card Redesign

## Summary

The opportunity card now leads with the practical decision context instead of a dense score wall. Each card answers:

- Why this setup?
- Upside potential?
- Main risk?
- Entry quality?
- Chase risk?
- What should I watch next?

The detailed score grid was moved into a collapsed `More context and scores` section so the first scan stays simple while advanced evidence remains available.

## UX Changes

- Added plain status labels: `Good setup`, `Watch only`, `Wait for pullback`, `High risk / high reward`, `Avoid chase`, and `Risk rising`.
- Replaced duplicated primary/secondary metric grids with question-based tiles.
- Added a compact `Entry and exit context` strip for research entry, do-not-chase, invalidation, and historical exit zones.
- Tightened mobile wrapping, overflow handling, and line clamping to prevent card text from pushing outside the viewport.
- Kept non-advisory language: cards use research entry, invalidation, historical exit, watch, and avoid-chase framing.

## Before / After

Before:
- Cards led with many metrics and repeated context blocks.
- Entry quality, chase risk, and invalidation were present but buried.
- Mobile risked cramped long-text layouts.

After:
- The card headline tells users whether it is a good setup, watch-only setup, pullback setup, chase-risk setup, or rising-risk setup.
- The first visible content explains the setup, upside, risk, entry quality, chase risk, and next condition to monitor.
- Detailed metrics are still accessible without dominating the card.

## Screenshot Artifacts

- Desktop: `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-6-opportunity-cards/opportunity-card-redesign-desktop-cdp.png`
- Mobile: `/Users/hdtv/dev/market-alpha-scanner/artifacts/phase-12-6-opportunity-cards/opportunity-card-redesign-mobile-cdp.png`

Screenshots used representative AMD, MU, and DDOG card data to validate the requested examples and mobile/desktop card behavior.

## Remaining Gaps

- Current live local `/opportunities` data was unavailable without production scanner output, so visual validation used representative preview data.
- Additional production-data QA should be repeated after the next scanner-backed deployment to verify real AMD/MU/DDOG card copy and row ordering.
