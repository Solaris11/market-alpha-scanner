# Phase 14.6 — Personalized Intelligence Workspace

## Summary

TradeVeto now has a lightweight personalized workspace layer. It keeps the existing intelligence architecture intact while letting each beta user prioritize the modules, symbols, timeframes, risk style, and mobile shortcuts they care about.

## What Changed

- Added `user_workspace_preferences` persistence for signed-in users.
- Added `/api/user/workspace-preferences` with CSRF, origin, auth, and rate-limit protection.
- Added local-first workspace persistence so the terminal feels immediate even before the account sync completes.
- Added a `Personal Workspace` panel in Terminal for:
  - favorite symbols
  - favorite modules
  - show/hide module controls
  - simple up/down module ordering
  - preferred timeframes
  - preferred risk style
  - workspace modes: Balanced, Watchlist-first, Macro-first, Swing trader, Investor
  - mobile preferred overview
  - pinned mobile cards
- Added personalized ordering/filtering for the clickable intelligence zones.
- Added mobile quick-access chips for last viewed symbol, favorite symbols, and pinned modules.
- Added symbol view tracking so the mobile workspace remembers the last symbol opened.

## Data Stored

The personalization layer stores only product preferences:

- favorite symbols
- favorite intelligence modules
- hidden modules
- module order
- pinned mobile cards
- preferred timeframes
- preferred risk style
- workspace mode
- mobile preferred overview
- last viewed symbol
- favorite actions

It does not store brokerage credentials, external trading account data, or private portfolio credentials.

## Workspace Modes

- **Balanced:** default terminal order for general users.
- **Watchlist-first:** prioritizes watchlist changes and alerts.
- **Macro-first:** prioritizes market state, macro pressure, and risk context.
- **Swing trader:** prioritizes best setups, shock watch, dangerous-now, and replay context.
- **Investor:** prioritizes macro, watchlist, replay, and broader context.

## UX Behavior

- Terminal intelligence zones reorder according to the selected mode and manual module order.
- Hidden modules are removed from the clickable zone grid.
- Favorite modules are visually marked as personal focus items.
- Favorite symbols appear in the personal focus strip and link directly to symbol detail.
- Mobile displays quick-access chips without compressing desktop panels into tiny controls.

## Validation

Local validation:

- `npm run lint`: passed
- `npm test -- --runInBand`: passed, 380 tests
- `npm run build`: passed
- `npm audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed

Production validation after push/deploy:

- migration applied: pending
- production pull/rebuild: pending
- `/terminal` smoke: pending
- `/symbol/AMD` smoke: pending
- `/api/health`: pending
- `/api/health/deep`: pending

## Remaining Work

- Add richer analytics around first-use customization behavior after the next beta cohort.
- Add optional saved dashboard presets only if users request deeper customization.
- Consider a true drag/drop layout only after current simple controls prove useful.

Final status: pending production validation.
